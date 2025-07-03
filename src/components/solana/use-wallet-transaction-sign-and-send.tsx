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

      // Add mobile-specific error handling
      try {
        const signature = await signAndSendTransactionMessageWithSigners(message)
        return getBase58Decoder().decode(signature)
      } catch (signError) {
        // Enhanced mobile error reporting
        const isMobile = navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')
        
        if (isMobile) {
          // Common mobile wallet issues
          if (signError instanceof Error) {
            if (signError.message.includes('User rejected') || signError.message.includes('denied')) {
              throw new Error('Transaction was cancelled by user on mobile wallet')
            } else if (signError.message.includes('insufficient funds')) {
              throw new Error('Insufficient SOL for transaction fees (mobile)')
            } else if (signError.message.includes('timeout') || signError.message.includes('network')) {
              throw new Error('Mobile network timeout - please check your connection and try again')
            } else if (signError.message.includes('blockhash')) {
              throw new Error('Transaction expired (mobile) - please try again')
            }
          }
          // Deep inspection of mobile error object
          let mobileErrorMsg = 'Unknown mobile error'
          
          if (signError instanceof Error) {
            mobileErrorMsg = signError.message
          } else if (signError && typeof signError === 'object') {
            const errorObj = signError as Record<string, unknown>
            
            // Try common error properties
            const possibleErrorProps = ['message', 'error', 'description', 'reason', 'code', 'name', 'details']
            let foundError = false
            
            for (const prop of possibleErrorProps) {
              if (errorObj[prop] && typeof errorObj[prop] === 'string') {
                mobileErrorMsg = `${prop}: ${errorObj[prop]}`
                foundError = true
                break
              }
            }
            
            if (!foundError) {
              // Show the full object structure for debugging
              try {
                const keys = Object.keys(errorObj)
                const errorStructure = keys.map(key => `${key}: ${typeof errorObj[key]}`).join(', ')
                mobileErrorMsg = `Object structure: {${errorStructure}} | Full: ${JSON.stringify(signError)}`
              } catch {
                mobileErrorMsg = `Complex object error (keys: ${Object.keys(errorObj).join(', ')})`
              }
            }
          } else {
            mobileErrorMsg = `Type: ${typeof signError}, Value: ${String(signError)}`
          }
          
          throw new Error(`Mobile transaction error: ${mobileErrorMsg}`)
        }
        
        throw signError
      }
    } catch (error) {
      // Top-level error handling
      if (error instanceof Error) {
        throw new Error(`Error processing the transaction: ${error.message}`)
      }
      throw new Error('Error processing the transaction: Unknown error')
    }
  }
}
