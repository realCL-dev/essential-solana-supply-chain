'use client'

import { ReactNode, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const ClientWalletProvider = dynamic(
  () => import('./client-wallet-provider').then((mod) => mod.ClientWalletProvider),
  { ssr: false }
)

interface EnhancedSolanaProviderProps {
  children: ReactNode
}

export function EnhancedSolanaProvider({ children }: EnhancedSolanaProviderProps) {
  return <ClientWalletProvider>{children}</ClientWalletProvider>
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