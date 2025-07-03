'use client'

// import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ReactNode /*, useState, useEffect */ } from 'react'

// Import wallet adapter CSS
// import '@solana/wallet-adapter-react-ui/styles.css'

interface MobileWalletProviderProps {
  children: ReactNode
  network?: WalletAdapterNetwork
}

export function MobileWalletProvider({
  children,
  // network = WalletAdapterNetwork.Devnet
}: MobileWalletProviderProps) {
  return <>{children}</>
}

// Network switching helper
export function useMobileWalletNetwork() {
  return {
    devnet: WalletAdapterNetwork.Devnet,
    testnet: WalletAdapterNetwork.Testnet,
    mainnet: WalletAdapterNetwork.Mainnet,
  }
}