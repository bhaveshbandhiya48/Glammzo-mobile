import { useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BookingDateSheet } from "@/components/book/BookingDateSheet"
import { RequestsHeader } from "@/components/requests/RequestsUi"
import { sp, ui } from "@/components/salon-page/theme"
import { Icon } from "@/components/ui/Icon"
import { Text } from "@/components/ui/Text"
import { formatEventDate, isQuoteCategory, QUOTE_CATEGORIES, QUOTE_OCCASIONS } from "@/lib/get-quotes"
import { createLead, leadErrorMessage } from "@/lib/leads-api"
import { getAccessToken } from "@/lib/session"
import { getSavedLocation } from "@/lib/user"
import { fontFamily } from "@/theme/tokens"

const DETAILS_MAX = 600
const PEOPLE_MIN = 1
const PEOPLE_MAX = 50
const TZ = "Asia/Kolkata"

function nextDays(count: number) {
  const keys: string[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    keys.push(new Date(now + i * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ }))
  }
  return keys
}

export default function NewRequestScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ category?: string }>()
  const initialCategory = isQuoteCategory(params.category) ? params.category : null

  const [checking, setChecking] = useState(true)
  const [category, setCategory] = useState<string | null>(initialCategory)
  const [occasion, setOccasion] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [people, setPeople] = useState(1)
  const [city, setCity] = useState("")
  const [savedCity, setSavedCity] = useState(false)
  const [area, setArea] = useState("")
  const [budget, setBudget] = useState("")
  const [details, setDetails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const days = useMemo(() => nextDays(60), [])
  const dateOptions = useMemo(() => days.map((d) => ({ date: d, label: formatEventDate(d) })), [days])

  useEffect(() => {
    let active = true
    void (async () => {
      const token = await getAccessToken()
      if (!active) return
      if (!token) {
        const next = initialCategory ? `/requests/new?category=${initialCategory}` : "/requests/new"
        router.replace({ pathname: "/login", params: { next } })
        return
      }
      const loc = await getSavedLocation().catch(() => null)
      if (!active) return
      const savedCityName = loc?.city?.trim() || ""
      if (savedCityName) {
        setCity(savedCityName)
        setSavedCity(true)
      }
      if (loc?.area?.trim()) setArea(loc.area.trim())
      setChecking(false)
    })()
    return () => {
      active = false
    }
  }, [initialCategory, router])

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/(tabs)" as Href)
  }

  async function onSend() {
    if (sending) return
    const cityName = city.trim()
    const budgetDigits = budget.replace(/[^\d]/g, "")
    if (!category) return setError("Choose what you need.")
    if (!date) return setError("Pick the event date.")
    if (cityName.length < 2) return setError("Add your city.")
    if (people < PEOPLE_MIN || people > PEOPLE_MAX) return setError("People must be between 1 and 50.")
    const budgetRupees = budgetDigits ? Number(budgetDigits) : null
    if (budgetRupees != null && budgetRupees > 1_000_000) return setError("Budget looks too high.")
    setError(null)
    setSending(true)
    try {
      const { id } = await createLead({
        city: cityName,
        area: area.trim() || null,
        category,
        occasion,
        eventDate: date,
        people,
        budgetRupees,
        details: details.trim() || null,
      })
      router.replace({ pathname: "/requests/[id]", params: { id } })
    } catch (err) {
      setError(leadErrorMessage(err, "Could not post your request. Please try again."))
    } finally {
      setSending(false)
    }
  }

  if (checking) {
    return (
      <View style={styles.root}>
        <RequestsHeader title="Get quotes" onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator color={sp.text} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <RequestsHeader title="Get quotes" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introTitle}>Tell artists what you need</Text>
        <Text style={styles.introBody}>
          Top artists in your city reply with their price. Your phone number is never shared.
        </Text>

        <Text style={[ui.sectionLabel, styles.label]}>What do you need?</Text>
        <View style={styles.chips}>
          {QUOTE_CATEGORIES.map((c) => {
            const on = category === c.id
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setCategory(c.id)}
                style={({ pressed }) => [ui.chip, on && ui.chipActive, pressed && ui.pressed]}
              >
                <Text style={[ui.chipText, on && ui.chipTextActive]}>{c.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={[ui.sectionLabel, styles.label]}>Occasion</Text>
        <View style={styles.chips}>
          {QUOTE_OCCASIONS.map((o) => {
            const on = occasion === o.id
            return (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setOccasion(on ? null : o.id)}
                style={({ pressed }) => [ui.chip, on && ui.chipActive, pressed && ui.pressed]}
              >
                <Text style={[ui.chipText, on && ui.chipTextActive]}>{o.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.pair}>
          <View style={styles.pairCol}>
            <Text style={[ui.sectionLabel, styles.label]}>Date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={date ? `Date, ${formatEventDate(date)}` : "Pick a date"}
              onPress={() => setDateOpen(true)}
              style={({ pressed }) => [styles.field, styles.fieldRow, pressed && ui.pressed]}
            >
              <Icon name="calendar-outline" size={18} color={sp.text} />
              <Text style={[styles.fieldText, !date && styles.placeholder]} numberOfLines={1}>
                {date ? formatEventDate(date) : "Pick a date"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.pairCol}>
            <Text style={[ui.sectionLabel, styles.label]}>People</Text>
            <View style={[styles.field, styles.stepper]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fewer people"
                disabled={people <= PEOPLE_MIN}
                hitSlop={6}
                onPress={() => setPeople((p) => Math.max(PEOPLE_MIN, p - 1))}
                style={[styles.stepBtn, people <= PEOPLE_MIN && styles.stepBtnOff]}
              >
                <Icon name="remove" size={18} color={sp.text} />
              </Pressable>
              <Text style={styles.stepValue} accessibilityLiveRegion="polite">
                {people}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More people"
                disabled={people >= PEOPLE_MAX}
                hitSlop={6}
                onPress={() => setPeople((p) => Math.min(PEOPLE_MAX, p + 1))}
                style={[styles.stepBtn, people >= PEOPLE_MAX && styles.stepBtnOff]}
              >
                <Icon name="add" size={18} color={sp.text} />
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={[ui.sectionLabel, styles.label]}>Where</Text>
        {savedCity ? (
          <View style={[styles.field, styles.fieldRow]}>
            <Icon name="location-outline" size={18} color={sp.text} />
            <Text style={styles.fieldText} numberOfLines={1}>
              {city}
            </Text>
          </View>
        ) : (
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={sp.secondary}
            accessibilityLabel="City"
            maxLength={60}
            style={[styles.field, styles.input]}
          />
        )}
        <TextInput
          value={area}
          onChangeText={setArea}
          placeholder="Area or locality (optional)"
          placeholderTextColor={sp.secondary}
          accessibilityLabel="Area"
          maxLength={80}
          style={[styles.field, styles.input, { marginTop: 10 }]}
        />
        <Text style={styles.hint}>
          {savedCity
            ? "Picked from your saved location. Artists in this city will see it."
            : "Artists in this city will see it."}
        </Text>

        <Text style={[ui.sectionLabel, styles.label]}>Budget (optional)</Text>
        <View style={[styles.field, styles.fieldRow]}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            value={budget}
            onChangeText={(v) => setBudget(v.replace(/[^\d]/g, "").slice(0, 7))}
            placeholder="e.g. 5000"
            placeholderTextColor={sp.secondary}
            keyboardType="number-pad"
            accessibilityLabel="Budget in rupees"
            style={styles.inlineInput}
          />
        </View>

        <Text style={[ui.sectionLabel, styles.label]}>Anything else? (optional)</Text>
        <TextInput
          value={details}
          onChangeText={(v) => setDetails(v.slice(0, DETAILS_MAX))}
          placeholder="Look you want, timing, home or studio, anything artists should know"
          placeholderTextColor={sp.secondary}
          multiline
          maxLength={DETAILS_MAX}
          accessibilityLabel="Anything else"
          style={[styles.field, styles.input, styles.textarea]}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>
          {details.length}/{DETAILS_MAX}
        </Text>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: sending, busy: sending }}
          disabled={sending}
          onPress={() => void onSend()}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.ctaText}>Send to artists</Text>}
        </Pressable>
        <Text style={styles.barNote}>Free · You&apos;ll get a notification for each quote</Text>
      </View>

      <BookingDateSheet
        visible={dateOpen}
        options={dateOptions}
        value={date}
        onClose={() => setDateOpen(false)}
        onSelect={(next) => {
          setDate(next)
          setDateOpen(false)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: sp.gutter, paddingTop: 20 },
  introTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: sp.text,
  },
  introBody: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.secondary,
  },
  label: { marginTop: 26, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pair: { flexDirection: "row", gap: 12 },
  pairCol: { flex: 1, minWidth: 0 },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: sp.border,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldText: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: sp.text,
  },
  placeholder: { color: sp.secondary, fontFamily: fontFamily.medium },
  input: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: sp.text,
    paddingVertical: 12,
  },
  inlineInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: sp.text,
  },
  rupee: { fontFamily: fontFamily.semibold, fontSize: 15, color: sp.text },
  textarea: { minHeight: 110 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: sp.grey,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnOff: { opacity: 0.4 },
  stepValue: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    lineHeight: 20,
    color: sp.text,
  },
  hint: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
  counter: {
    marginTop: 6,
    alignSelf: "flex-end",
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: sp.secondary,
  },
  error: {
    marginTop: 16,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    color: sp.closed,
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: sp.gutter,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sp.border,
  },
  cta: {
    height: 52,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: { backgroundColor: "#2b2b2b" },
  ctaText: { fontFamily: fontFamily.semibold, fontSize: 15, color: "#ffffff" },
  barNote: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: fontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
  },
})
