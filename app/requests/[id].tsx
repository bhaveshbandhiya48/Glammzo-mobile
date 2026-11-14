import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PhotoOrFallback } from "@/components/home/PhotoFallback"
import { Pill, RequestsHeader, StatusPill } from "@/components/requests/RequestsUi"
import { softShadow, sp, ui } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import {
  daysLeft,
  formatEventDate,
  MAX_QUOTES,
  peopleLabel,
  requestTitle,
} from "@/lib/get-quotes"
import {
  acceptLeadQuote,
  closeLead,
  fetchLead,
  leadErrorMessage,
  type LeadQuote,
  type LeadRequest,
} from "@/lib/leads-api"
import { formatRupees } from "@/lib/service-pricing"
import { getAccessToken } from "@/lib/session"
import { fontFamily } from "@/theme/tokens"

type Loaded = { request: LeadRequest; quotes: LeadQuote[] }

export default function RequestDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string }>()
  const id = typeof params.id === "string" ? params.id : ""
  const [data, setData] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      router.replace({ pathname: "/login", params: { next: `/requests/${id}` } })
      return
    }
    try {
      setData(await fetchLead(id))
      setLoadError(null)
    } catch (err) {
      setLoadError(leadErrorMessage(err, "Could not load this request."))
    }
  }, [id, router])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function goBack() {
    if (router.canGoBack()) router.back()
    else router.replace("/requests" as Href)
  }

  function openBooking(quote: LeadQuote, quoteRupees: number | null, category: string) {
    router.push({
      pathname: "/artist/book/[slug]",
      params: {
        slug: quote.artistSlug,
        leadResponseId: quote.responseId,
        quoteRupees: String(quoteRupees ?? quote.quoteRupees ?? ""),
        leadCategory: category,
      },
    })
  }

  function confirmClose() {
    Alert.alert("Close this request?", "Artists will stop seeing it and can't send more quotes.", [
      { text: "Keep open", style: "cancel" },
      {
        text: "Close request",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy("close")
            setActionError(null)
            try {
              await closeLead(id)
              await load()
            } catch (err) {
              setActionError(leadErrorMessage(err, "Could not close this request."))
            } finally {
              setBusy(null)
            }
          })()
        },
      },
    ])
  }

  function confirmBook(quote: LeadQuote) {
    if (!data) return
    const price = quote.quoteRupees != null ? formatRupees(quote.quoteRupees) : "the quoted price"
    Alert.alert(`Book ${quote.displayName} for ${price}?`, "Other quotes on this request will be declined.", [
      { text: "Not yet", style: "cancel" },
      {
        text: "Book",
        onPress: () => {
          void (async () => {
            setBusy(quote.responseId)
            setActionError(null)
            try {
              const accepted = await acceptLeadQuote(id, quote.responseId)
              void load()
              openBooking({ ...quote, artistSlug: accepted.artistSlug || quote.artistSlug }, accepted.quoteRupees, data.request.category)
            } catch (err) {
              setActionError(leadErrorMessage(err, "Could not accept this quote."))
            } finally {
              setBusy(null)
            }
          })()
        },
      },
    ])
  }

  const request = data?.request
  const isOpen = request?.status === "open"

  return (
    <View style={styles.root}>
      <RequestsHeader
        title="My request"
        onBack={goBack}
        right={
          isOpen ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy === "close"}
              hitSlop={8}
              onPress={confirmClose}
            >
              <Text style={styles.closeText}>{busy === "close" ? "Closing…" : "Close request"}</Text>
            </Pressable>
          ) : null
        }
      />
      {!data ? (
        <View style={styles.center}>
          {loadError ? (
            <>
              <Text style={styles.error}>{loadError}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                style={({ pressed }) => [ui.addPill, { marginTop: 12 }, pressed && ui.pressed]}
              >
                <Text style={ui.addPillText}>Try again</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={sp.text} />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          showsVerticalScrollIndicator={false}
        >
          <Summary request={data.request} quoteCount={data.quotes.length} />

          {actionError ? <Text style={[styles.error, { marginTop: 14 }]}>{actionError}</Text> : null}

          <Text style={[ui.sectionLabel, styles.sectionLabel]}>Quotes</Text>
          {data.quotes.length === 0 ? (
            <View style={styles.noQuotes}>
              <Text style={styles.noQuotesText}>
                Artists usually reply within a few hours. We&apos;ll notify you.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {data.quotes.map((quote) => (
                <QuoteCard
                  key={quote.responseId}
                  quote={quote}
                  anyAccepted={data.quotes.some((q) => q.status === "accepted")}
                  canBook={data.request.status !== "expired"}
                  busy={busy === quote.responseId}
                  onViewProfile={() =>
                    router.push({ pathname: "/artist/[slug]", params: { slug: quote.artistSlug } })
                  }
                  onBook={() => confirmBook(quote)}
                  onContinue={() => openBooking(quote, quote.quoteRupees, data.request.category)}
                />
              ))}
            </View>
          )}

          <Text style={styles.footer}>We&apos;ll notify you when more artists reply.</Text>
        </ScrollView>
      )}
    </View>
  )
}

function Summary({ request, quoteCount }: { request: LeadRequest; quoteCount: number }) {
  const where = [request.area, request.city].filter(Boolean).join(", ")
  const meta = [
    formatEventDate(request.eventDate),
    peopleLabel(request.people),
    where,
    request.budgetRupees != null ? `Budget ${formatRupees(request.budgetRupees)}` : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const n = Math.min(quoteCount, MAX_QUOTES)
  const d = daysLeft(request.expiresAt)
  const progress =
    request.status === "open"
      ? `${n} of ${MAX_QUOTES} quotes in · stays open ${d} more ${d === 1 ? "day" : "days"}`
      : `${n} of ${MAX_QUOTES} quotes in`
  return (
    <View style={[styles.summary, softShadow]}>
      <View style={styles.summaryTop}>
        <Text style={styles.summaryTitle}>{requestTitle(request.category, request.occasion)}</Text>
        <StatusPill status={request.status} />
      </View>
      <Text style={styles.summaryMeta}>{meta}</Text>
      {request.details ? (
        <Text style={styles.summaryDetails} numberOfLines={3}>
          {request.details}
        </Text>
      ) : null}
      <Text style={styles.progressText}>{progress}</Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: MAX_QUOTES, now: n }}
      >
        <View style={[styles.fill, { width: `${(n / MAX_QUOTES) * 100}%` }]} />
      </View>
    </View>
  )
}

function QuoteCard({
  quote,
  anyAccepted,
  canBook,
  busy,
  onViewProfile,
  onBook,
  onContinue,
}: {
  quote: LeadQuote
  anyAccepted: boolean
  canBook: boolean
  busy: boolean
  onViewProfile: () => void
  onBook: () => void
  onContinue: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const accepted = quote.status === "accepted"
  const dimmed = anyAccepted && !accepted
  const showLevel = Boolean(quote.levelLabel) && quote.levelLabel !== "Getting started"
  const ratingLine =
    quote.reviewCount > 0 && quote.rating != null
      ? `${quote.rating.toFixed(1)}★ (${quote.reviewCount})${quote.area ? ` · ${quote.area}` : ""}`
      : `New${quote.area ? ` · ${quote.area}` : ""}`
  const longMessage = quote.message.length > 180 || quote.message.split("\n").length > 4

  return (
    <View style={[styles.quote, dimmed && styles.dimmed]}>
      <View style={styles.quoteTop}>
        <View style={styles.photo}>
          <PhotoOrFallback uri={quote.profilePhotoUrl} name={quote.displayName} />
        </View>
        <View style={styles.quoteWho}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {quote.displayName}
            </Text>
            {showLevel ? (
              <View style={ui.offerBadge}>
                <Text style={ui.offerBadgeText}>{quote.levelLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rating} numberOfLines={1}>
            {ratingLine}
          </Text>
        </View>
        {accepted ? (
          <Pill label="Accepted" bg={sp.ratingBg} ink={sp.ratingInk} />
        ) : dimmed ? (
          <Pill label="Not selected" bg={sp.grey} ink={sp.secondary} />
        ) : null}
      </View>

      <Text style={styles.price}>
        {quote.quoteRupees != null ? formatRupees(quote.quoteRupees) : "Price on request"}
      </Text>
      {quote.message ? (
        <>
          <Text style={styles.message} numberOfLines={expanded ? undefined : 4}>
            {quote.message}
          </Text>
          {longMessage ? (
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setExpanded((v) => !v)}>
              <Text style={styles.more}>{expanded ? "less" : "more"}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onViewProfile}
          style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && ui.pressed]}
        >
          <Text style={styles.btnOutlineText}>View profile</Text>
        </Pressable>
        {accepted ? (
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [styles.btn, styles.btnSolid, pressed && ui.pressed]}
          >
            <Text style={styles.btnSolidText}>Continue booking</Text>
          </Pressable>
        ) : !dimmed && canBook && quote.quoteRupees != null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onBook}
            style={({ pressed }) => [styles.btn, styles.btnSolid, pressed && ui.pressed]}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnSolidText}>Book this artist</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: sp.gutter },
  scroll: { paddingHorizontal: sp.gutter, paddingTop: 16 },
  closeText: { fontFamily: fontFamily.semibold, fontSize: 14, color: sp.closed },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: sp.closed, textAlign: "center" },
  summary: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sp.border,
  },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 23, color: sp.text },
  summaryMeta: { marginTop: 6, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, color: sp.secondary },
  summaryDetails: { marginTop: 8, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.body },
  progressText: { marginTop: 14, fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: sp.text },
  track: { marginTop: 8, height: 4, borderRadius: 2, backgroundColor: sp.grey, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: sp.text },
  sectionLabel: { marginTop: 28, marginBottom: 12 },
  noQuotes: { borderRadius: 16, backgroundColor: sp.grey, padding: 16 },
  noQuotesText: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: sp.body },
  quote: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: 1,
    borderColor: sp.border,
  },
  dimmed: { opacity: 0.55 },
  quoteTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 52, height: 52, borderRadius: 16, overflow: "hidden", backgroundColor: sp.grey },
  quoteWho: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, color: sp.text },
  rating: { marginTop: 2, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, color: sp.secondary },
  price: { marginTop: 14, fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 23, color: sp.text },
  message: { marginTop: 6, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: sp.body },
  more: { marginTop: 2, fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, color: sp.text },
  actions: { marginTop: 14, flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnOutline: { borderWidth: 1.5, borderColor: sp.text, backgroundColor: "#ffffff" },
  btnOutlineText: { fontFamily: fontFamily.semibold, fontSize: 14, color: sp.text },
  btnSolid: { backgroundColor: sp.text },
  btnSolidText: { fontFamily: fontFamily.semibold, fontSize: 14, color: "#ffffff" },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
})
