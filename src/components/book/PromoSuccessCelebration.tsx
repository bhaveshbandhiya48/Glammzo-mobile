import { formatRupees } from "@/lib/service-pricing"
import { useEffect, useMemo, useRef } from "react"
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { PrimaryPill } from "@/components/profile/ProfileScreenParts"
import { pastels, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { CheckoutAppOffer } from "@/lib/app-offers-api"
import type { AppliedOfferDiscount } from "@/lib/promo-api"
import { colors, fontFamily, spacing } from "@/theme/tokens"

export type PromoCelebrationPayload =
  | { kind: "discount"; discount: AppliedOfferDiscount }
  | { kind: "app_offer"; offer: CheckoutAppOffer }

type Props = {
  visible: boolean
  payload: PromoCelebrationPayload | null
  onClose: () => void
}

const CONFETTI_COLORS = [
  colors.primary,
  "#ffe1d6",
  "#e6dcff",
  "#d3f0e2",
  "#fbdbe8",
  "#fdeec2",
  "#d9ebfb",
  "#FFFFFF",
]

type Particle = {
  id: number
  left: number
  size: number
  color: string
  delay: number
  drift: number
  rotate: number
  duration: number
  shape: "rect" | "circle"
}

function ConfettiBurst({ active }: { active: boolean }) {
  const { width, height } = useWindowDimensions()
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 42 }, (_, id) => ({
        id,
        left: Math.random() * width,
        size: 5 + Math.random() * 7,
        color: CONFETTI_COLORS[id % CONFETTI_COLORS.length]!,
        delay: Math.random() * 280,
        drift: (Math.random() - 0.5) * 120,
        rotate: (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 220),
        duration: 2200 + Math.random() * 900,
        shape: Math.random() > 0.45 ? "rect" : "circle",
      })),
    [width],
  )

  const anims = useRef(particles.map(() => new Animated.Value(0))).current

  useEffect(() => {
    if (!active) {
      anims.forEach((value) => value.setValue(0))
      return
    }

    const runners = particles.map((particle, index) =>
      Animated.timing(anims[index]!, {
        toValue: 1,
        duration: particle.duration,
        delay: particle.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    )

    Animated.parallel(runners).start()
  }, [active, anims, particles])

  if (!active) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => {
        const progress = anims[index]!
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-24, height * 0.92],
        })
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, particle.drift],
        })
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", `${particle.rotate}deg`],
        })
        const opacity = progress.interpolate({
          inputRange: [0, 0.08, 0.75, 1],
          outputRange: [0, 1, 0.85, 0],
        })
        const scale = progress.interpolate({
          inputRange: [0, 0.12, 1],
          outputRange: [0.4, 1, 0.7],
        })

        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.confetti,
              {
                left: particle.left,
                width: particle.shape === "rect" ? particle.size * 0.55 : particle.size,
                height: particle.size,
                borderRadius:
                  particle.shape === "circle" ? particle.size / 2 : 2,
                backgroundColor: particle.color,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }, { scale }],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

function formatDiscountLabel(discount: AppliedOfferDiscount) {
  if (discount.discountType === "percent") {
    return `${discount.discountValue}% off`
  }
  return `${formatRupees(discount.discountValue)} off`
}

export function PromoSuccessCelebration({ visible, payload, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const cardScale = useRef(new Animated.Value(0.86)).current
  const cardOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible || !payload) {
      cardScale.setValue(0.86)
      cardOpacity.setValue(0)
      return
    }

    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start()
  }, [visible, payload, cardOpacity, cardScale])

  if (!payload) return null

  const isDiscount = payload.kind === "discount"
  const headline = isDiscount
    ? `You got ${formatRupees(payload.discount.discountAmount)} off`
    : `You got ${formatRupees(payload.offer.discountRupees)} off`
  const title = isDiscount ? payload.discount.title : payload.offer.title
  const code = isDiscount ? payload.discount.code : (payload.offer.code ?? "Glammzo offer")
  const detail = isDiscount
    ? `${formatDiscountLabel(payload.discount)} · Code ${code}`
    : `${payload.offer.headline} · paid by Glammzo`
  const subdetail = isDiscount
    ? `New total ${formatRupees(payload.discount.finalTotal)} (was ${formatRupees(payload.discount.subtotal)})`
    : "Taken off your bill now"
  const burstKey = isDiscount
    ? `${payload.discount.code}-${Math.round(payload.discount.discountAmount)}`
    : `${payload.offer.id}-${payload.offer.discountRupees}`

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ConfettiBurst key={burstKey} active={visible} />

        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <View style={styles.badge}>
            <GradientFill colors={pastels.mint.gradient} angle={150} />
            <Icon name="sparkles" size={30} color={pastels.mint.ink} />
          </View>

          <Text style={[ui.sectionLabel, styles.kicker]}>Congratulations</Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.offerBox}>
            <View style={styles.offerRow}>
              <Icon name="pricetag-outline" size={16} color="#17633e" />
              <Text style={styles.offerCode}>{code}</Text>
            </View>
            <Text style={styles.detail}>{detail}</Text>
            <Text style={styles.subdetail}>{subdetail}</Text>
          </View>

          <View style={styles.cta}>
            <PrimaryPill label="Awesome" onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  confetti: {
    position: "absolute",
    top: 0,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    zIndex: 2,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  kicker: {
    marginBottom: 6,
  },
  headline: {
    textAlign: "center",
    fontFamily: fontFamily.bold,
    fontSize: 24,
    lineHeight: 30,
    color: "#111111",
  },
  title: {
    textAlign: "center",
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#595959",
  },
  offerBox: {
    width: "100%",
    marginTop: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9fd3b3",
    backgroundColor: "#e6f5ec",
    gap: 4,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offerCode: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 1,
    color: "#17633e",
  },
  detail: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: "#111111",
  },
  subdetail: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#595959",
  },
  cta: {
    width: "100%",
  },
})
