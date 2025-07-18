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
  const { client, account } = useWalletUi()

  return async (ix: IInstruction, signer: TransactionSendingSigner) => {
    // Validate wallet connection before proceeding
    if (!account) {
      throw new Error('Wallet not connected. Please connect your wallet and try again.')
    }

    if (!signer) {
      throw new Error('Transaction signer not available. Please check your wallet connection.')
    }

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
          await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1s before retry
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
      console.error('Transaction signing error:', error)

      if (error instanceof Error) {
        throw new Error(`Error processing the transaction: ${error.message}`)
      }
      throw new Error('Error processing the transaction: Unknown error')
    }
  }
}
