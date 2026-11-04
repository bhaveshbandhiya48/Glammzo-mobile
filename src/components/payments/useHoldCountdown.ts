import { useEffect, useRef, useState } from "react"

export function formatHoldLeft(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** Milliseconds left on a held slot, ticking each second. Calls onExpired once when it hits zero. */
export function useHoldCountdown(deadline: string | undefined, onExpired?: () => void) {
  const [now, setNow] = useState(() => Date.now())
  const expiredFor = useRef<string | null>(null)
  const onExpiredRef = useRef(onExpired)
  onExpiredRef.current = onExpired
  const ends = deadline ? Date.parse(deadline) : null

  useEffect(() => {
    if (ends == null) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ends])

  const left = ends != null ? ends - now : null
  useEffect(() => {
    if (left == null || left > 0 || !deadline || expiredFor.current === deadline) return
    expiredFor.current = deadline
    onExpiredRef.current?.()
  }, [deadline, left])

  return left
}
