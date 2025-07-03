'use client'

import { ReactNode, useState, useEffect } from 'react'
import { SolanaProvider } from './solana-provider'
import { MobileWalletProvider } from './mobile-wallet-provider'
import { WalletAdapterBridge } from './wallet-adapter-bridge'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

interface ClientWalletProviderProps {
  children: ReactNode
}

export function ClientWalletProvider({ children }: ClientWalletProviderProps) {
  const [useMobileWallet, setUseMobileWallet] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true) // Component has mounted on the client
    const checkMobile = () => {
      const userAgent = navigator.userAgent || (navigator as unknown as { vendor?: string }).vendor || (window as unknown as { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(String(userAgent).toLowerCase())
    }

    const mobile = checkMobile()
    const preference = localStorage.getItem('wallet-preference')
    setUseMobileWallet(mobile || preference === 'mobile')
  }, [])

  // If not mounted yet (SSR), or if desktop is preferred, render SolanaProvider
  if (!mounted || !useMobileWallet) {
    return (
      <SolanaProvider>
        <div className="desktop-wallet-enabled">
          {children}
        </div>
      </SolanaProvider>
    )
  }

  // If mounted and mobile is preferred, render MobileWalletProvider
  return (
    <MobileWalletProvider network={WalletAdapterNetwork.Devnet}>
      <WalletAdapterBridge network={WalletAdapterNetwork.Devnet}>
        <div className="mobile-wallet-enabled">
          {children}
        </div>
      </WalletAdapterBridge>
    </MobileWalletProvider>
  )
}
