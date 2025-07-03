'use client'

import { ReactNode, useState, useEffect } from 'react'
import { SolanaProvider } from './solana-provider'
import { MobileWalletProvider } from './mobile-wallet-provider'
import { WalletAdapterBridge } from './wallet-adapter-bridge'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

interface EnhancedSolanaProviderProps {
  children: ReactNode
}

export function EnhancedSolanaProvider({ children }: EnhancedSolanaProviderProps) {
  const [useMobileWallet, setUseMobileWallet] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || (navigator as unknown as { vendor?: string }).vendor || (window as unknown as { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(String(userAgent).toLowerCase())
    }
    
    const mobile = checkMobile()
    
    // Check if user prefers mobile wallet (stored in localStorage)
    const preference = localStorage.getItem('wallet-preference')
    setUseMobileWallet(mobile || preference === 'mobile')
  }, [])

  // Mobile wallet system
  if (useMobileWallet) {
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

  // Original gill-based system for desktop
  return (
    <SolanaProvider>
      <div className="desktop-wallet-enabled">
        {children}
      </div>
    </SolanaProvider>
  )
}

// Wallet preference selector component
export function WalletSystemSelector() {
  const [currentSystem, setCurrentSystem] = useState<'auto' | 'mobile' | 'desktop'>('auto')

  useEffect(() => {
    const preference = localStorage.getItem('wallet-preference') || 'auto'
    setCurrentSystem(preference as 'auto' | 'mobile' | 'desktop')
  }, [])

  const handleSystemChange = (system: 'auto' | 'mobile' | 'desktop') => {
    setCurrentSystem(system)
    localStorage.setItem('wallet-preference', system)
    
    // Reload page to apply new wallet system
    window.location.reload()
  }

  return (
    <div className="p-4 bg-gray-50 border rounded-lg">
      <h3 className="font-medium mb-3">Wallet System</h3>
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={currentSystem === 'auto'}
            onChange={() => handleSystemChange('auto')}
          />
          <span>Auto (Recommended)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={currentSystem === 'mobile'}
            onChange={() => handleSystemChange('mobile')}
          />
          <span>📱 Mobile Wallet Apps</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={currentSystem === 'desktop'}
            onChange={() => handleSystemChange('desktop')}
          />
          <span>🖥️ Browser Extension</span>
        </label>
      </div>
      <div className="text-xs text-gray-600 mt-2">
        Current: {currentSystem === 'auto' ? 'Auto-detected' : currentSystem === 'mobile' ? 'Mobile Apps' : 'Browser Extension'}
      </div>
    </div>
  )
}