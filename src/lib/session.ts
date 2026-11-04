import AsyncStorage from "@react-native-async-storage/async-storage"
import * as SecureStore from "expo-secure-store"

const TOKEN_KEY = "glammzo_access_token"

async function readToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY)
    const token = raw?.trim()
    if (token) return token.replace(/^Bearer\s+/i, "").trim() || null
  } catch {
    // SecureStore unavailable (e.g. web stub) — try AsyncStorage.
  }
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY)
    const token = raw?.trim()
    if (!token) return null
    return token.replace(/^Bearer\s+/i, "").trim() || null
  } catch {
    return null
  }
}

export async function getAccessToken(): Promise<string | null> {
  return readToken()
}

export async function setAccessToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    return
  } catch {
    // Fallback when Metro resolved the browser stub (no localStorage on native).
  }
  await AsyncStorage.setItem(TOKEN_KEY, token)
}

export async function clearAccessToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}
