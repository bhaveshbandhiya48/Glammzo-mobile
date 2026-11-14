import { useFocusEffect, useRouter, type Href } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GradientFill } from "@/components/home/GradientFill"
import { ThumbOrFallback } from "@/components/home/PhotoFallback"
import { RequestsHeader, StatusPill } from "@/components/requests/RequestsUi"
import { pastels, softShadow, sp, ui } from "@/components/salon-page/theme"
import { Text } from "@/components/ui/Text"
import { formatEventDate, peopleLabel, requestTitle, staysOpenLabel } from "@/lib/get-quotes"
import { fetchLeads, leadErrorMessage, type LeadListItem } from "@/lib/leads-api"
import { getAccessToken } from "@/lib/session"
import { fontFamily } from "@/theme/tokens"

export default function MyRequestsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<LeadListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      router.replace({ pathname: "/login", params: { next: "/requests" } })
      return
    }
    try {
      setItems(await fetchLeads())
      setError(null)
    } catch (err) {
      setError(leadErrorMessage(err, "Could not load your requests."))
      setItems((prev) => prev ?? [])
    }
  }, [router])

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
    else router.replace("/(tabs)/profile" as Href)
  }

  return (
    <View style={styles.root}>
      <RequestsHeader title="My requests" onBack={goBack} />
      {items == null ? (
        <View style={styles.center}>
          <ActivityIndicator color={sp.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {items.length === 0 && !error ? (
            <View style={styles.empty}>
              <GradientFill colors={pastels.peach.gradient} angle={140} radius={22} />
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptyBody}>
                Tell artists what you need and get up to 5 prices, free.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/requests/new")}
                style={({ pressed }) => [styles.emptyCta, pressed && ui.pressed]}
              >
                <Text style={styles.emptyCtaText}>Get quotes</Text>
              </Pressable>
            </View>
          ) : (
            items.map((item) => <RequestCard key={item.id} item={item} />)
          )}
          {items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/requests/new")}
              style={({ pressed }) => [ui.addPill, styles.newBtn, pressed && ui.pressed]}
            >
              <Text style={ui.addPillText}>New request</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

function RequestCard({ item }: { item: LeadListItem }) {
  const router = useRouter()
  const meta = [formatEventDate(item.eventDate), peopleLabel(item.people), item.area || item.city]
    .filter(Boolean)
    .join(" · ")
  const quotes = `${item.quoteCount} ${item.quoteCount === 1 ? "quote" : "quotes"}`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${requestTitle(item.category, item.occasion)}, ${meta}, ${item.status}, ${quotes}`}
      onPress={() => router.push({ pathname: "/requests/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.card, softShadow, pressed && ui.pressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {requestTitle(item.category, item.occasion)}
        </Text>
        <StatusPill status={item.status} />
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {meta}
      </Text>
      <View style={styles.cardFoot}>
        {item.artistAvatars.length > 0 ? (
          <View style={styles.stack}>
            {item.artistAvatars.slice(0, 3).map((uri, index) => (
              <ThumbOrFallback
                key={`${uri}-${index}`}
                uri={uri}
                name={`${item.id}-${index}`}
                style={[styles.avatar, index > 0 && { marginLeft: -8 }]}
              />
            ))}
          </View>
        ) : null}
        <Text style={styles.quotes}>{quotes}</Text>
        {item.status === "open" ? (
          <Text style={styles.open} numberOfLines={1}>
            · {staysOpenLabel(item.expiresAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: sp.gutter, paddingTop: 16, gap: 12 },
  error: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: sp.closed },
  empty: {
    borderRadius: 22,
    overflow: "hidden",
    padding: 20,
    marginTop: 8,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: 19, lineHeight: 24, color: sp.text },
  emptyBody: {
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: sp.body,
  },
  emptyCta: {
    marginTop: 16,
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: sp.text,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { fontFamily: fontFamily.semibold, fontSize: 14, color: "#ffffff" },
  card: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sp.border,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 21, color: sp.text },
  cardMeta: {
    marginTop: 4,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: sp.secondary,
  },
  cardFoot: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  stack: { flexDirection: "row" },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  quotes: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 17, color: sp.text },
  open: { flexShrink: 1, fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, color: sp.ratingInk },
  newBtn: { alignSelf: "center", marginTop: 8 },
})
