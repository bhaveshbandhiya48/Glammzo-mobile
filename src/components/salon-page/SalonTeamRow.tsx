import { Image } from "expo-image"
import { ScrollView, StyleSheet, View } from "react-native"

import { GradientFill } from "@/components/home/GradientFill"
import { pastelForName } from "@/components/home/PhotoFallback"
import { Text } from "@/components/ui/Text"
import type { Salon } from "@/data/types"
import { fontFamily } from "@/theme/tokens"

import { sp } from "./theme"

export function SalonTeamRow({ team }: { team: Salon["team"] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {team.map((member) => {
        const photo = member.imageUrl?.trim()
        const pastel = pastelForName(member.name)
        return (
          <View key={member.id} style={styles.item} accessible accessibilityLabel={`${member.name}, ${member.role}`}>
            <View style={styles.squircle}>
              {photo ? (
                <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : (
                <>
                  <GradientFill colors={pastel.gradient} angle={150} radius={22} />
                  <Text style={[styles.initial, { color: pastel.ink }]}>
                    {member.name.trim().charAt(0).toUpperCase() || "G"}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            {member.role ? (
              <Text style={styles.role} numberOfLines={1}>
                {member.role}
              </Text>
            ) : null}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: 12,
    paddingHorizontal: sp.gutter,
  },
  item: {
    width: 76,
    alignItems: "center",
  },
  squircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: sp.grey,
    marginBottom: 8,
  },
  initial: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  name: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: sp.text,
    textAlign: "center",
    maxWidth: 76,
  },
  role: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
    color: sp.secondary,
    textAlign: "center",
    maxWidth: 76,
  },
})
