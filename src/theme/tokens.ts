export const colors = {
  bg: "#F6F4F1",
  text: "#000000",
  coral: "#F95C48",
  sand: "#E4DED2",
  border: "#E4DED2",
  surface: "#FBF9F6",
  card: "#FCFBF9",
  muted: "#F1EDE6",
  textMuted: "#6B6B6B",
  textSubtle: "#8F8F8F",
  primaryFg: "#FFFFFF",
  destructive: "#DC2626",
  success: "#1F7A4D",
  overlay: "rgba(0, 0, 0, 0.4)",
  chrome: "rgba(251, 249, 246, 0.92)",
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const

export const radii = {
  sm: 10,
  md: 14,
  lg: 17,
  xl: 22,
  pill: 999,
} as const

export const typography = {
  logo: {
    fontFamily: "BricolageGrotesque_700Bold",
    fontSize: 22,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: "Sora_700Bold",
    fontSize: 26,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: "Sora_600SemiBold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
  },
} as const

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const
