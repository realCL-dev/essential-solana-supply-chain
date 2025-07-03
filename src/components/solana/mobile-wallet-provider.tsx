'use client'

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { 
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  GlowWalletAdapter,
  BackpackWalletAdapter,
  TrustWalletAdapter
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import { ReactNode, useMemo } from 'react'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

interface MobileWalletProviderProps {
  children: ReactNode
  network?: WalletAdapterNetwork
}

export function MobileWalletProvider({ 
  children, 
  network = WalletAdapterNetwork.Devnet 
}: MobileWalletProviderProps) {
  // Configure the endpoint based on network
  const endpoint = useMemo(() => {
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
  }, [network])

  // Configure wallet adapters with mobile optimization
  const wallets = useMemo(() => [
    // Phantom - Most popular mobile wallet
    new PhantomWalletAdapter(),
    
    // Solflare - Good mobile support
    new SolflareWalletAdapter(),
    
    // Glow - Mobile-first design
    new GlowWalletAdapter(),
    
    // Backpack - xNFT support
    new BackpackWalletAdapter(),
    
    // Trust Wallet - Mobile support
    new TrustWalletAdapter(),
  ], [])

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
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
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