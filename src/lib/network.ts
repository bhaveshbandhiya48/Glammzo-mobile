import type { NetInfoState } from "@react-native-community/netinfo"

/** True when the device reports no usable network. Null reachability is not offline. */
export function isDeviceOffline(state: NetInfoState): boolean {
  if (state.isConnected === false) return true
  if (state.isInternetReachable === false) return true
  return false
}
