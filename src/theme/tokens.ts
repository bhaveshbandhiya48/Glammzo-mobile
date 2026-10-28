/**
 * Glammzo brand tokens, shared with the Partner app. Every screen reads colour
 * from here, so a rebrand is a change to `palette` alone.
 *
 * Contrast (WCAG 2.2 AA): text tokens are 4.5:1 or more on `bg`, `surface` and
 * `fill`; `primary` takes white text at 4.5:1 or more; `inputBorder` is 3:1 or
 * more against the page and cards (1.4.11). `line` is decorative only — never
 * the only edge of a control. Orange lives only in the logo, icon and splash.
 */
const palette = {
  /** Near-black: buttons, links, selected states, icons. White text on it is 18:1. */
  primary: "#111111",
  primaryPressed: "#2B2B2B",
  /** Light grey: selected chips and soft buttons, always with a black edge or text. */
  primarySoft: "#F1F1F1",
  /** The one dark "what's next" card per screen. */
  hero: "#111111",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  fill: "#F2F2F2",
  line: "#EBEBEB",
  inputBorder: "#858585",
  ink: "#111111",
  inkMuted: "#5C5C5C",
  /** Placeholders and quiet captions — still 4.5:1 on every surface. */
  inkSubtle: "#6A6A6A",
} as const

/**
 * Status colours: the only colour in the app. Light tints behind dark text (5.8:1 or more),
 * and they never follow the brand, so "Paid" always reads as success.
 */
export const status = {
  successFg: "#146C2E",
  successBg: "#EAF7EE",
  warnFg: "#7A5200",
  warnBg: "#FFF4D6",
  dangerFg: "#B42318",
  dangerBg: "#FEEDEB",
  infoFg: "#1D4ED8",
  infoBg: "#EBF2FE",
  violetFg: "#5B3CC4",
  violetBg: "#F1ECFE",
} as const

export const colors = {
  bg: palette.bg,
  text: palette.ink,
  primary: palette.primary,
  primaryPressed: palette.primaryPressed,
  primarySoft: palette.primarySoft,
  hero: palette.hero,
  sand: palette.line,
  border: palette.line,
  inputBorder: palette.inputBorder,
  surface: palette.surface,
  card: palette.surface,
  muted: palette.fill,
  textMuted: palette.inkMuted,
  textSubtle: palette.inkSubtle,
  primaryFg: "#FFFFFF",
  destructive: status.dangerFg,
  success: status.successFg,
  /** Gold for star ratings only. */
  star: "#B7791F",
  overlay: "rgba(0, 0, 0, 0.4)",
  chrome: "rgba(250, 250, 250, 0.94)",
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
  lg: 18,
  xl: 22,
  pill: 999,
} as const

/** One family (Geist), like the Partner app. */
export const fontFamily = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
} as const

export const typography = {
  logo: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
} as const

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const
