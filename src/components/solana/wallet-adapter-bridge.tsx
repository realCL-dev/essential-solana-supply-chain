'use client'

import { createContext, useContext, ReactNode } from 'react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
// import { PublicKey, TransactionInstruction } from '@solana/web3.js'
// import { useMobileWalletTransaction } from './mobile-wallet-transaction'
// import { useMemo, useState, useEffect, useCallback } from 'react'

// Bridge context to make wallet adapter compatible with existing gill-based code
interface WalletAdapterBridgeContextType {
  // Wallet state
  connected: boolean
  publicKey: PublicKey | null
  connecting: boolean
  
  // Network
  cluster: string
  network: WalletAdapterNetwork
  
  // Transaction methods
  signAndSendTransaction: (instruction: TransactionInstruction) => Promise<string>
  
  // Compatibility with existing useWalletUi interface
  client: {
    rpc: {
      getLatestBlockhash: () => Promise<{ value: { blockhash: string; lastValidBlockHeight: number } }>
      getBalance: (address: PublicKey) => Promise<{ value: number }>
      getGenesisHash: () => Promise<string>
    }
  }
}

const WalletAdapterBridgeContext = createContext<WalletAdapterBridgeContextType | null>(null)

export function WalletAdapterBridge({
  children,
  network = WalletAdapterNetwork.Devnet
}: {
  children: ReactNode
  network?: WalletAdapterNetwork
}) {
  const value: WalletAdapterBridgeContextType = {
    connected: false,
    publicKey: null,
    connecting: false,
    cluster: 'devnet',
    network,
    signAndSendTransaction: async () => { throw new Error('Wallet functionality is disabled') },
    client: {
      rpc: {
        getLatestBlockhash: async () => ({ value: { blockhash: '', lastValidBlockHeight: 0 } }),
        getBalance: async () => ({ value: 0 }),
        getGenesisHash: async () => ''
      }
    }
  }

  return (
    <WalletAdapterBridgeContext.Provider value={value}>
      {children}
    </WalletAdapterBridgeContext.Provider>
  )
}

// Hook to use the bridge context
export function useWalletAdapterBridge() {
  const context = useContext(WalletAdapterBridgeContext)
  if (!context) {
    // Return a default value or throw an error if context is not available
    // This ensures that the hook always returns a consistent type
    return {
      connected: false,
      publicKey: null,
      connecting: false,
      cluster: '',
      network: WalletAdapterNetwork.Devnet,
      signAndSendTransaction: async () => { throw new Error('Wallet not connected') },
      client: {
        rpc: {
          getLatestBlockhash: async () => ({ value: { blockhash: '', lastValidBlockHeight: 0 } }),
          getBalance: async () => ({ value: 0 }),
          getGenesisHash: async () => ''
        }
      }
    }
  }
  return context
}

// Compatibility hooks that mimic the existing gill-based hooks
export function useWalletUiSigner() {
  const { publicKey } = useWalletAdapterBridge()
  
  if (!publicKey) {
    throw new Error('Wallet not connected')
  }

  return {
    address: publicKey,
    signAndSendTransactions: async () => {
      throw new Error('Use signAndSendTransaction instead')
    }
  }
}

export function useWalletUi() {
  const bridge = useWalletAdapterBridge()
  
  return {
    cluster: bridge.cluster,
    client: bridge.client,
  }
}

export function useWalletTransactionSignAndSend() {
  const { signAndSendTransaction } = useWalletAdapterBridge()
  
  return async (instruction: TransactionInstruction) => {
    const signature = await signAndSendTransaction(instruction)
    // Convert signature to the format expected by existing code
    return signature
  }
}
