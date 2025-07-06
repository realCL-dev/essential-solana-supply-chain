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

const TRANSACTION_PROCESSING_DELAY = 2000

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

export function useInitializeProductMutation() {
  const { cluster } = useWalletUi()
  const queryClient = useQueryClient()
  const signer = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    mutationFn: async ({ serialNumber, description }: { serialNumber: string; description: string }) => {
      try {
        const instruction = await getInitializeProductInstructionAsync({
          owner: signer,
          serialNumber,
          description,
        })
        
        const result = await signAndSend(instruction, signer)
        return result
      } catch (error) {
        console.error('Error in mutationFn:', error)
        console.error('Error type:', typeof error)
        console.error('Error constructor:', error?.constructor?.name)
        
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
        
        throw error
      }
    },

    onSuccess: async (tx) => {
      toastTx(tx)
      
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_PROCESSING_DELAY))
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'products', { cluster }] }),
        queryClient.invalidateQueries({ queryKey: ['supply_chain'] }),
        queryClient.refetchQueries({ queryKey: ['supply_chain', 'products', { cluster }] })
      ])
    },

    onError: (error) => {
      console.error('Initialize product error:', error)
      let errorMessage = 'Failed to initialize product'
      
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
      } else {
        errorMessage = 'Product creation failed: Unknown error'
      }
      
      toast.error(errorMessage)
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
      const productAccount = await fetchProduct(client.rpc, productAddress)
      
      const [eventAccountPDA] = await getProgramDerivedAddress({
        programAddress: programId,
        seeds: [
          getBytesEncoder().encode(new TextEncoder().encode("event")),
          getAddressEncoder().encode(productAddress),
          getU64Encoder().encode(productAccount.data.eventsCounter),
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
      
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_PROCESSING_DELAY))
      
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

export function useProductAccountsQuery() {
  const { client } = useWalletUi()
  const programId = useSupplyChainProgramId()

  return useQuery({
    queryKey: useProductAccountsQueryKey(),
    
    queryFn: async () => {
      try {
        const programAccounts = await client.rpc.getProgramAccounts(programId, {
          encoding: 'base64'
        }).send()
        
        if (!programAccounts || programAccounts.length === 0) {
          return []
        }

        const productAddresses = programAccounts
          .filter(account => {
            const data = account.account.data
            if (!data) return false
            
            let dataBytes: Uint8Array
            if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
              try {
                dataBytes = new Uint8Array(Buffer.from(data[0] as string, 'base64'))
              } catch {
                return false
              }
            } else if (typeof data === 'string') {
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

export function useProductEventsQuery(productAddress: Address) {
  const { client } = useWalletUi()
  const programId = useSupplyChainProgramId()

  return useQuery({
    queryKey: ['supply_chain', 'events', productAddress],
    
    queryFn: async () => {
      try {
        const product = await fetchProduct(client.rpc, productAddress)
        const eventsCount = Number(product.data.eventsCounter)
        
        if (eventsCount === 0) {
          return []
        }

        const eventPromises = []
        for (let i = 0; i < eventsCount; i++) {
          const [eventPDA] = await getProgramDerivedAddress({
            programAddress: programId,
            seeds: [
              getBytesEncoder().encode(new TextEncoder().encode("event")),
              getAddressEncoder().encode(productAddress),
              getU64Encoder().encode(BigInt(i)),
            ],
          })
          eventPromises.push(fetchSupplyChainEvent(client.rpc, eventPDA))
        }

        const events = await Promise.all(eventPromises)
        
        return events.sort((a, b) => Number(a.data.eventIndex) - Number(b.data.eventIndex))
      } catch (error) {
        console.error('Error fetching events:', error)
        return []
      }
    },
    enabled: !!productAddress,
  })
}

function useProductAccountsInvalidate() {
  const queryClient = useQueryClient()
  const queryKey = useProductAccountsQueryKey()

  return () => queryClient.invalidateQueries({ queryKey })
}

function useProductAccountsQueryKey() {
  const { cluster } = useWalletUi()
  return ['supply_chain', 'products', { cluster }]
}

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

export { EventType, ProductStatus }