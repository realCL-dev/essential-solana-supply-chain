'use client'

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

import { clusterApiUrl } from '@solana/web3.js'
import { ReactNode, useMemo, useState, useEffect } from 'react'

// Import wallet adapter CSS
// import '@solana/wallet-adapter-react-ui/styles.css'

interface MobileWalletProviderProps {
  children: ReactNode
  network?: WalletAdapterNetwork
}

export function MobileWalletProvider({
  children,
  network = WalletAdapterNetwork.Devnet
}: MobileWalletProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Configure the endpoint based on network
  const endpoint = useMemo(() => {
    if (!mounted) return '' // Return empty string or a placeholder until mounted
    switch (network) {
      case WalletAdapterNetwork.Devnet:
        return clusterApiUrl('devnet')
      case WalletAdapterNetwork.Testnet:
        return clusterApiUrl('testnet')
      case WalletAdapterNetwork.Mainnet:
        return clusterApiUrl('mainnet-beta')
      default:
        return clusterApiUrl('devnet')
    }
  }, [network, mounted])

  // Configure wallet adapters with mobile optimization
  const wallets = useMemo(() => {
    if (!mounted) return [] // Return empty array until mounted
    return []
  }, [mounted])

  if (!mounted) {
    return null // Or a loading spinner
  }

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: 'confirmed',
        // Mobile-optimized timeouts
        confirmTransactionInitialTimeout: 60000,
        wsEndpoint: undefined, // Disable websocket for mobile stability
      }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={false} // Don't auto-connect on mobile for better UX
      >
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}

// Network switching helper
export function useMobileWalletNetwork() {
  return {
    devnet: WalletAdapterNetwork.Devnet,
    testnet: WalletAdapterNetwork.Testnet,
    mainnet: WalletAdapterNetwork.Mainnet,
  }
}