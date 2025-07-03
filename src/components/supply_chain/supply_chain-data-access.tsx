import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useWalletUi } from '@wallet-ui/react'
import { useWalletTransactionSignAndSend } from '../solana/use-wallet-transaction-sign-and-send'
import { useClusterVersion } from '@/components/cluster/use-cluster-version'
import { toastTx } from '@/components/toast-tx'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'
import { 
  getInitializeProductInstructionAsync,
  getLogEventInstruction,
  getTransferOwnershipInstruction,
  fetchProduct,
  fetchAllProduct,
  fetchSupplyChainEvent,
  SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
  EventType,
  ProductStatus,
  PRODUCT_DISCRIMINATOR
} from '@project/anchor'
import type { Address } from 'gill'
import { getProgramDerivedAddress, getBytesEncoder, getAddressEncoder, getU64Encoder } from 'gill'

export function useSupplyChainProgramId() {
  return SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS
}

export function useSupplyChainProgram() {
  const { client, cluster } = useWalletUi()
  const programId = useSupplyChainProgramId()
  const query = useClusterVersion()

  return useQuery({
    retry: false,
    queryKey: ['get-program-account', { cluster, clusterVersion: query.data }],
    queryFn: () => client.rpc.getAccountInfo(programId).send(),
  })
}

// Product-related hooks
export function useInitializeProductMutation() {
  const { cluster } = useWalletUi()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async ({ serialNumber, description }: { serialNumber: string; description: string }) => {
      const instruction = await getInitializeProductInstructionAsync({
        owner: signer,
        serialNumber,
        description,
      })
      return await signAndSend(instruction, signer)
    },
    onSuccess: async (tx) => {
      toastTx(tx)
      
      // Wait a bit for the transaction to be fully processed on-chain
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Invalidate multiple related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'products', { cluster }] }),
        queryClient.invalidateQueries({ queryKey: ['supply_chain'] }), // Broader invalidation
        queryClient.refetchQueries({ queryKey: ['supply_chain', 'products', { cluster }] }) // Force refetch
      ])
    },
    onError: (error) => {
      console.error('Initialize product error:', error)
      let errorMessage = 'Failed to initialize product'
      let debugInfo = ''
      
      if (error instanceof Error) {
        if (error.message.includes('0x7d6') || error.message.includes('ConstraintSeeds')) {
          errorMessage = 'Product creation failed: Invalid account setup. Please try again.'
        } else if (error.message.includes('0x1772') || error.message.includes('UnauthorizedAccess')) {
          errorMessage = 'Product creation failed: Unauthorized access. Check wallet permissions.'
        } else if (error.message.includes('insufficient funds') || error.message.includes('0x1')) {
          errorMessage = 'Product creation failed: Insufficient SOL for transaction fees.'
        } else if (error.message.includes('User rejected') || error.message.includes('rejected')) {
          errorMessage = 'Transaction was cancelled by user.'
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
          errorMessage = 'Product creation failed: Network timeout. Please check your connection and try again.'
        } else {
          errorMessage = `Product creation failed: ${error.message}`
        }
        debugInfo = error.message
      } else if (typeof error === 'string') {
        errorMessage = `Product creation failed: ${error}`
        debugInfo = error
      } else if (error && typeof error === 'object') {
        const errorObj = error as any
        if (errorObj.message) {
          debugInfo = errorObj.message
          errorMessage = `Product creation failed: ${errorObj.message}`
        } else if (errorObj.error) {
          debugInfo = errorObj.error
          errorMessage = `Product creation failed: ${errorObj.error}`
        } else {
          debugInfo = JSON.stringify(error)
          errorMessage = `Product creation failed: Unknown error (check debug info)`
        }
      } else {
        debugInfo = `Type: ${typeof error}, Value: ${String(error)}`
        errorMessage = 'Product creation failed: Unknown error type'
      }
      
      // Add mobile/browser context
      const isMobile = navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone')
      const browserInfo = isMobile ? 'Mobile' : 'Desktop'
      
      toast.error(`${errorMessage} [${browserInfo}] - Debug: ${debugInfo}`)
    },
  })
}

export function useLogEventMutation() {
  const invalidateAccounts = useProductAccountsInvalidate()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()
  const { client } = useWalletUi()
  const programId = useSupplyChainProgramId()

  return useMutation({
    mutationFn: async ({ 
      productAddress, 
      eventType, 
      description 
    }: { 
      productAddress: Address; 
      eventType: EventType; 
      description: string 
    }) => {
      // First, fetch the product account to get the events counter
      const productAccount = await fetchProduct(client.rpc, productAddress)
      
      // Derive the event PDA using the same seeds as the backend:
      // [b"event", product_account.key().as_ref(), product_account.events_counter.to_le_bytes().as_ref()]
      const [eventAccountPDA] = await getProgramDerivedAddress({
        programAddress: programId,
        seeds: [
          getBytesEncoder().encode(new Uint8Array([101, 118, 101, 110, 116])), // "event"
          getAddressEncoder().encode(productAddress),
          getU64Encoder().encode(productAccount.data.eventsCounter), // events_counter as u64 little-endian
        ],
      })

      const instruction = getLogEventInstruction({
        productAccount: productAddress,
        eventAccount: eventAccountPDA,
        signer,
        eventType,
        description,
      })
      
      return { tx: await signAndSend(instruction, signer), productAddress }
    },
    onSuccess: async ({ tx, productAddress }) => {
      toastTx(tx)
      
      // Wait a bit for the transaction to be fully processed on-chain
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Invalidate both product accounts and events for this specific product
      await Promise.all([
        invalidateAccounts(),
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'events', productAddress] }),
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'product', productAddress] })
      ])
    },
    onError: () => toast.error('Failed to log event'),
  })
}

export function useTransferOwnershipMutation() {
  const invalidateAccounts = useProductAccountsInvalidate()
  const signAndSend = useWalletTransactionSignAndSend()
  const signer = useWalletUiSigner()

  return useMutation({
    mutationFn: async ({ 
      productAddress, 
      newOwner 
    }: { 
      productAddress: Address; 
      newOwner: Address 
    }) => {
      const instruction = getTransferOwnershipInstruction({
        productAccount: productAddress,
        currentOwner: signer,
        newOwner,
      })
      return await signAndSend(instruction, signer)
    },
    onSuccess: async (tx) => {
      toastTx(tx)
      await invalidateAccounts()
    },
    onError: () => toast.error('Failed to transfer ownership'),
  })
}

// Query hooks for products
export function useProductAccountsQuery() {
  const { client } = useWalletUi()
  const programId = useSupplyChainProgramId()

  return useQuery({
    queryKey: useProductAccountsQueryKey(),
    queryFn: async () => {
      try {
        // Get all accounts owned by the program
        const programAccounts = await client.rpc.getProgramAccounts(programId, {
          encoding: 'base64'
        }).send()
        
        if (!programAccounts || programAccounts.length === 0) {
          return []
        }

        // Filter for Product accounts only (check discriminator)
        const productAddresses = programAccounts
          .filter(account => {
            // Check if account data starts with Product discriminator
            const data = account.account.data
            if (!data) return false
            
            // Handle base64 encoded data response
            let dataBytes: Uint8Array
            if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
              // data is [base64String, 'base64']
              try {
                dataBytes = new Uint8Array(Buffer.from(data[0] as string, 'base64'))
              } catch {
                return false
              }
            } else if (typeof data === 'string') {
              // Direct base64 string
              try {
                dataBytes = new Uint8Array(Buffer.from(data, 'base64'))
              } catch {
                return false
              }
            } else if (data instanceof Uint8Array) {
              dataBytes = data
            } else if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
              dataBytes = new Uint8Array(data as number[])
            } else {
              return false
            }
            
            if (dataBytes.length < 8) return false
            
            // Compare first 8 bytes with Product discriminator
            return dataBytes.slice(0, 8).every((byte, i) => byte === PRODUCT_DISCRIMINATOR[i])
          })
          .map(account => account.pubkey)

        if (productAddresses.length === 0) {
          return []
        }

        return await fetchAllProduct(client.rpc, productAddresses)
      } catch (error) {
        console.error('Error fetching product accounts:', error)
        return []
      }
    },
  })
}

export function useProductQuery(address: Address) {
  const { client } = useWalletUi()

  return useQuery({
    queryKey: ['supply_chain', 'product', address],
    queryFn: async () => await fetchProduct(client.rpc, address),
    enabled: !!address,
  })
}

// Events query hook
export function useProductEventsQuery(productAddress: Address) {
  const { client } = useWalletUi()
  const programId = useSupplyChainProgramId()

  return useQuery({
    queryKey: ['supply_chain', 'events', productAddress],
    queryFn: async () => {
      try {
        // First get the product to know how many events exist
        const product = await fetchProduct(client.rpc, productAddress)
        const eventsCount = Number(product.data.eventsCounter)
        
        if (eventsCount === 0) {
          return []
        }

        // Derive all event PDAs for this product
        const eventPromises = []
        for (let i = 0; i < eventsCount; i++) {
          const [eventPDA] = await getProgramDerivedAddress({
            programAddress: programId,
            seeds: [
              getBytesEncoder().encode(new Uint8Array([101, 118, 101, 110, 116])), // "event"
              getAddressEncoder().encode(productAddress),
              getU64Encoder().encode(BigInt(i)), // event index as u64
            ],
          })
          eventPromises.push(fetchSupplyChainEvent(client.rpc, eventPDA))
        }

        // Fetch all events in parallel
        const events = await Promise.all(eventPromises)
        
        // Sort by event index (timestamp)
        return events.sort((a, b) => Number(a.data.eventIndex) - Number(b.data.eventIndex))
      } catch (error) {
        console.error('Error fetching events:', error)
        return []
      }
    },
    enabled: !!productAddress,
  })
}

// Utility hooks
function useProductAccountsInvalidate() {
  const queryClient = useQueryClient()
  const queryKey = useProductAccountsQueryKey()

  return () => queryClient.invalidateQueries({ queryKey })
}

function useProductAccountsQueryKey() {
  const { cluster } = useWalletUi()
  return ['supply_chain', 'products', { cluster }]
}

// Form state hooks
export function useCreateProductForm() {
  const [serialNumber, setSerialNumber] = useState('')
  const [description, setDescription] = useState('')

  const reset = () => {
    setSerialNumber('')
    setDescription('')
  }

  return {
    serialNumber,
    setSerialNumber,
    description,
    setDescription,
    reset,
    isValid: serialNumber.trim().length > 0 && description.trim().length > 0
  }
}

export function useLogEventForm() {
  const [eventType, setEventType] = useState<EventType>(EventType.Created)
  const [description, setDescription] = useState('')

  const reset = () => {
    setEventType(EventType.Created)
    setDescription('')
  }

  return {
    eventType,
    setEventType,
    description,
    setDescription,
    reset,
    isValid: description.trim().length > 0
  }
}

// Export types for convenience
export { EventType, ProductStatus }