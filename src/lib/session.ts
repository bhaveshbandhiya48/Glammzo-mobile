import * as SecureStore from "expo-secure-store"

const TOKEN_KEY = "glammzo_access_token"

export async function getAccessToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY)
    const token = raw?.trim()
    if (!token) return null
    return token.replace(/^Bearer\s+/i, "").trim() || null
  } catch {
    return null
  }
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}
