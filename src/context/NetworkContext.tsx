import NetInfo from "@react-native-community/netinfo"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { isDeviceOffline } from "@/lib/network"
import { hydrateCatalogFromStorage } from "@/lib/salons-api"

type NetworkContextValue = {
  isOffline: boolean
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    void hydrateCatalogFromStorage()
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(isDeviceOffline(state))
    })
    return () => unsubscribe()
  }, [])

  const value = useMemo<NetworkContextValue>(() => ({ isOffline }), [isOffline])

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  )
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider")
  return ctx
}
