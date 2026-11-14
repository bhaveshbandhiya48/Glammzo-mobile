import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native"

import { Icon, type IconName } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { fontFamily } from "@/theme/tokens"

import { softShadow, sp } from "./theme"

function RoundButton({
  icon,
  label,
  color = sp.text,
  solid,
  onPress,
}: {
  icon: IconName
  label: string
  color?: string
  solid: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, !solid && softShadow, solid && styles.btnSolid, pressed && { opacity: 0.85 }]}
    >
      <Icon name={icon} size={20} color={color} />
    </Pressable>
  )
}

type Props = {
  topInset: number
  solid: boolean
  title: string
  favorited: boolean
  onBack: () => void
  onShare: () => void
  onToggleFavorite: () => void
  onLayout?: (event: LayoutChangeEvent) => void
}

/** Floating back / share / heart over the hero; turns solid with the name after scrolling. */
export function SalonTopBar({ topInset, solid, title, favorited, onBack, onShare, onToggleFavorite, onLayout }: Props) {
  return (
    <View
      onLayout={onLayout}
      pointerEvents="box-none"
      style={[styles.bar, { paddingTop: topInset + 10 }, solid && styles.barSolid]}
    >
      <RoundButton icon="chevron-back" label="Go back" solid={solid} onPress={onBack} />
      {solid ? (
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.right}>
        <RoundButton icon="share-outline" label="Share salon" solid={solid} onPress={onShare} />
        <RoundButton
          icon={favorited ? "heart" : "heart-outline"}
          label={favorited ? "Remove favorite" : "Save salon"}
          color={favorited ? "#e0245e" : sp.text}
          solid={solid}
          onPress={onToggleFavorite}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  barSolid: {
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: sp.tabBorder,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSolid: {
    backgroundColor: sp.grey,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    lineHeight: 20,
    color: sp.text,
  },
  spacer: {
    flex: 1,
  },
  right: {
    flexDirection: "row",
    gap: 10,
  },
})
