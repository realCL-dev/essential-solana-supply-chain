'use client'

import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useMobileWalletTransaction } from './mobile-wallet-transaction'
import { createContext, useContext, ReactNode, useMemo } from 'react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'

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
  const { connected, publicKey, connecting } = useWallet()
  const { connection } = useConnection()
  const { sendTransactionMobile, createTransactionFromInstructions } = useMobileWalletTransaction()

  // Create a client object that mimics the gill client interface
  const client = useMemo(() => ({
    rpc: {
      getLatestBlockhash: async () => {
        const result = await connection.getLatestBlockhash('confirmed')
        return {
          value: {
            blockhash: result.blockhash,
            lastValidBlockHeight: result.lastValidBlockHeight
          }
        }
      },
      getBalance: async (address: PublicKey) => {
        const balance = await connection.getBalance(address)
        return { value: balance }
      },
      getGenesisHash: async () => {
        return await connection.getGenesisHash()
      }
    }
  }), [connection])

  const signAndSendTransaction = async (instruction: TransactionInstruction): Promise<string> => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected')
    }

    const transaction = await createTransactionFromInstructions([instruction])
    return await sendTransactionMobile(transaction)
  }

  const cluster = useMemo(() => {
    switch (network) {
      case WalletAdapterNetwork.Mainnet:
        return 'mainnet-beta'
      case WalletAdapterNetwork.Testnet:
        return 'testnet'
      case WalletAdapterNetwork.Devnet:
      default:
        return 'devnet'
    }
  }, [network])

  const value: WalletAdapterBridgeContextType = {
    connected,
    publicKey,
    connecting,
    cluster,
    network,
    signAndSendTransaction,
    client,
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
    throw new Error('useWalletAdapterBridge must be used within WalletAdapterBridge')
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