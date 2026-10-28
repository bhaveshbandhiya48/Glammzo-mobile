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

import { Button } from "@/components/ui/Button"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import type { AppliedOfferDiscount, PromoCashbackClaim } from "@/lib/promo-api"
import { colors, radii, spacing } from "@/theme/tokens"

export type PromoCelebrationPayload =
  | { kind: "discount"; discount: AppliedOfferDiscount }
  | { kind: "cashback"; cashback: PromoCashbackClaim }

type Props = {
  visible: boolean
  payload: PromoCelebrationPayload | null
  onClose: () => void
}

const CONFETTI_COLORS = [
  colors.coral,
  "#F9A89A",
  colors.sand,
  "#E8D5C4",
  "#FFD166",
  "#06D6A0",
  "#4ECDC4",
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
    : `You got ₹${payload.cashback.cashbackRupees} cashback`
  const title = isDiscount ? payload.discount.title : "Wallet cashback unlocked"
  const code = isDiscount ? payload.discount.code : payload.cashback.code
  const detail = isDiscount
    ? `${formatDiscountLabel(payload.discount)} · Code ${code}`
    : payload.cashback.message
  const subdetail = isDiscount
    ? `New total ${formatRupees(payload.discount.finalTotal)} (was ${formatRupees(payload.discount.subtotal)})`
    : `Code ${code} · credited after your visit`
  const burstKey = isDiscount
    ? `${payload.discount.code}-${Math.round(payload.discount.discountAmount)}`
    : `${payload.cashback.code}-${payload.cashback.cashbackRupees}`

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

        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

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
            <Icon name="sparkles" size={28} color={colors.coral} />
          </View>

          <Text variant="label" color={colors.coral} style={styles.kicker}>
            Congratulations
          </Text>
          <Text variant="title" style={styles.headline}>
            {headline}
          </Text>
          <Text muted style={styles.title}>
            {title}
          </Text>

          <View style={styles.offerBox}>
            <View style={styles.offerRow}>
              <Icon name="pricetag" size={18} color={colors.coral} />
              <Text variant="bodyStrong" style={styles.offerCode}>
                {code}
              </Text>
            </View>
            <Text style={styles.detail}>{detail}</Text>
            <Text variant="caption" muted style={styles.subdetail}>
              {subdetail}
            </Text>
          </View>

          <Button label="Awesome" onPress={onClose} style={styles.cta} />
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
    backgroundColor: colors.bg,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    zIndex: 2,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1EE",
    marginBottom: spacing.lg,
  },
  kicker: {
    marginBottom: spacing.sm,
  },
  headline: {
    textAlign: "center",
    fontSize: 24,
  },
  title: {
    textAlign: "center",
    marginTop: spacing.sm,
  },
  offerBox: {
    width: "100%",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  offerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  offerCode: {
    letterSpacing: 0.6,
  },
  detail: {
    color: colors.text,
  },
  subdetail: {
    marginTop: 2,
  },
  cta: {
    width: "100%",
  },
})
