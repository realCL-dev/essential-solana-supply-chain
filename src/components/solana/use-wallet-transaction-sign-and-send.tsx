import { useWalletUi } from '@wallet-ui/react'
import {
  appendTransactionMessageInstruction,
  assertIsTransactionMessageWithSingleSendingSigner,
  createTransactionMessage,
  getBase58Decoder,
  IInstruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  TransactionSendingSigner,
  type Blockhash,
} from 'gill'

export function useWalletTransactionSignAndSend() {
  const { client } = useWalletUi()

  return async (ix: IInstruction, signer: TransactionSendingSigner) => {
    try {
      // Get latest blockhash with retry for mobile networks
      let latestBlockhash: { blockhash: Blockhash; lastValidBlockHeight: bigint } | undefined
      let retries = 3
      while (retries > 0) {
        try {
          const result = await client.rpc.getLatestBlockhash().send()
          latestBlockhash = result.value
          break
        } catch (error) {
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retry
        }
      }

      if (!latestBlockhash) {
        throw new Error('Failed to get latest blockhash after retries')
      }

      const message = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstruction(ix, tx),
      )

      assertIsTransactionMessageWithSingleSendingSigner(message)

      const signature = await signAndSendTransactionMessageWithSigners(message)
      return getBase58Decoder().decode(signature)
    } catch (error) {
      // Enhanced error logging
      console.error('Transaction signing error - Full error object:', error)
      console.error('Transaction signing error - Error type:', typeof error)
      console.error('Transaction signing error - Error constructor:', error?.constructor?.name)
      
      if (error instanceof Error) {
        console.error('Transaction signing error - Message:', error.message)
        console.error('Transaction signing error - Stack:', error.stack)
        console.error('Transaction signing error - Cause:', error.cause)
      }
      
      // Try to extract more details from the error
      if (error && typeof error === 'object') {
        const errorObj = error as Record<string, unknown>
        console.error('Transaction signing error - Object keys:', Object.keys(errorObj))
        console.error('Transaction signing error - Full object:', JSON.stringify(errorObj, null, 2))
      }
      
      // Top-level error handling
      if (error instanceof Error) {
        throw new Error(`Error processing the transaction: ${error.message}`)
      }
      throw new Error('Error processing the transaction: Unknown error')
    }
  }
}
