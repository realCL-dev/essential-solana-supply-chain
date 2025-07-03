'use client'

import { useState, useEffect } from 'react'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || (navigator as unknown as { vendor?: string }).vendor || (window as unknown as { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(String(userAgent).toLowerCase())
    }
    setIsMobile(checkMobile())
  }, [])

  return isMobile
}
