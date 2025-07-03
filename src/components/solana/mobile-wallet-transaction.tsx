'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction, TransactionInstruction } from '@solana/web3.js'
import { useCallback } from 'react'

export function useMobileWalletTransaction() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const sendTransactionMobile = useCallback(async (
    transaction: Transaction,
    options?: {
      skipPreflight?: boolean
      preflightCommitment?: 'processed' | 'confirmed' | 'finalized'
      maxRetries?: number
    }
  ) => {
    if (!publicKey || !sendTransaction) {
      throw new Error('Wallet not connected')
    }

    try {
      // Mobile-optimized transaction settings
      const mobileOptions = {
        skipPreflight: false,
        preflightCommitment: 'confirmed' as const,
        maxRetries: 3,
        ...options
      }

      // Get recent blockhash with retry for mobile networks
      let blockhashInfo
      let retries = 3
      while (retries > 0) {
        try {
          blockhashInfo = await connection.getLatestBlockhash('confirmed')
          break
        } catch (error) {
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Set recent blockhash and fee payer
      if (!blockhashInfo) {
        throw new Error('Failed to get recent blockhash')
      }
      transaction.recentBlockhash = blockhashInfo.blockhash
      transaction.feePayer = publicKey

      // Send transaction with mobile optimizations
      const signature = await sendTransaction(transaction, connection, mobileOptions)

      // Wait for confirmation with mobile-friendly timeout
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: blockhashInfo.blockhash,
        lastValidBlockHeight: blockhashInfo.lastValidBlockHeight,
      }, 'confirmed')

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`)
      }

      return signature
    } catch (error) {
      // Enhanced mobile error handling
      const isMobile = navigator.userAgent.includes('Mobile') || 
                      navigator.userAgent.includes('Android') || 
                      navigator.userAgent.includes('iPhone')

      let errorMessage = 'Transaction failed'
      
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was cancelled by user'
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient SOL for transaction fees'
        } else if (error.message.includes('blockhash')) {
          errorMessage = 'Transaction expired - please try again'
        } else if (error.message.includes('timeout')) {
          errorMessage = isMobile ? 'Mobile network timeout - please try again' : 'Network timeout'
        } else {
          errorMessage = `Transaction error: ${error.message}`
        }
      }

      if (isMobile) {
        errorMessage += ' (Mobile)'
      }

      throw new Error(errorMessage)
    }
  }, [connection, publicKey, sendTransaction])

  const createTransactionFromInstructions = useCallback(async (
    instructions: TransactionInstruction[]
  ): Promise<Transaction> => {
    if (!publicKey) {
      throw new Error('Wallet not connected')
    }

    const transaction = new Transaction()
    instructions.forEach(instruction => {
      transaction.add(instruction)
    })

    return transaction
  }, [publicKey])

  return {
    sendTransactionMobile,
    createTransactionFromInstructions,
    isConnected: !!publicKey,
    publicKey,
  }
}

// Mobile-specific transaction status component
export function MobileTransactionStatus({ 
  isLoading, 
  signature, 
  error 
}: { 
  isLoading: boolean
  signature?: string
  error?: string 
}) {
  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <div className="text-sm text-blue-800">
            Processing transaction on mobile...
          </div>
        </div>
        <div className="text-xs text-blue-600 mt-2">
          This may take a few moments on mobile networks
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-sm text-red-800 font-medium">
          Transaction Failed
        </div>
        <div className="text-xs text-red-600 mt-1">
          {error}
        </div>
      </div>
    )
  }

  if (signature) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-sm text-green-800 font-medium">
          ✅ Transaction Successful
        </div>
        <div className="text-xs text-green-600 mt-1 break-all">
          {signature}
        </div>
      </div>
    )
  }

  return null
}