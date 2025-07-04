/**
 * SUPPLY CHAIN DATA ACCESS LAYER
 * 
 * This file serves as the primary data access layer for the Solana-based supply chain application.
 * It provides React hooks that interact with the Solana blockchain to manage products and events
 * in a supply chain tracking system.
 * 
 * KEY CONCEPTS:
 * 
 * 1. SOLANA BLOCKCHAIN INTEGRATION:
 *    - Uses the Gill library for Solana blockchain interactions
 *    - Connects to Solana RPC endpoints to read/write blockchain data
 *    - Handles transaction signing and sending through wallet adapters
 * 
 * 2. REACT QUERY PATTERN:
 *    - Uses TanStack React Query for state management and caching
 *    - Provides automatic refetching, caching, and background updates
 *    - Separates data fetching concerns from UI components
 * 
 * 3. SUPPLY CHAIN DOMAIN MODEL:
 *    - Products: Core entities in the supply chain with unique serial numbers
 *    - Events: Timestamped actions that occur to products (created, shipped, received, etc.)
 *    - Ownership: Products have owners who can transfer ownership and log events
 * 
 * 4. PROGRAM DERIVED ADDRESSES (PDAs):
 *    - Solana accounts derived deterministically from seeds
 *    - Enables predictable account addresses without private keys
 *    - Used for both product accounts and event accounts
 * 
 * 5. ANCHOR FRAMEWORK:
 *    - Uses Anchor-generated client code for type-safe Solana program interactions
 *    - Provides instruction builders and account fetchers
 *    - Handles serialization/deserialization of program data
 */

// React Query for state management and caching of blockchain data
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
// React hooks for local component state
import { useState } from 'react'
// Toast notifications for user feedback
import { toast } from 'sonner'
// Wallet connection and cluster information from Wallet UI
import { useWalletUi } from '@wallet-ui/react'
// Custom hook for transaction signing and sending
import { useWalletTransactionSignAndSend } from '../solana/use-wallet-transaction-sign-and-send'
// Cluster version for cache invalidation
import { useClusterVersion } from '@/components/cluster/use-cluster-version'
// Transaction success notifications
import { toastTx } from '@/components/toast-tx'
// Wallet signer for transaction authorization
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'
// Anchor-generated client code for the supply chain program
import { 
  getInitializeProductInstructionAsync,  // Creates instruction to initialize a new product
  getLogEventInstruction,                // Creates instruction to log an event for a product
  getTransferOwnershipInstruction,       // Creates instruction to transfer product ownership
  fetchProduct,                          // Fetches a single product account from blockchain
  fetchAllProduct,                       // Fetches multiple product accounts in batch
  fetchSupplyChainEvent,                 // Fetches a single event account from blockchain
  SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,  // The deployed program's address on Solana
  EventType,                             // Enum defining types of events (Created, Shipped, etc.)
  ProductStatus,                         // Enum defining product statuses
  PRODUCT_DISCRIMINATOR                  // 8-byte identifier for Product accounts
} from '@project/anchor'
// Solana address type definition
import type { Address } from 'gill'
// Gill utilities for Program Derived Address calculation and data encoding
import { getProgramDerivedAddress, getBytesEncoder, getAddressEncoder, getU64Encoder } from 'gill'

/**
 * TRANSACTION PROCESSING DELAY
 * 
 * After sending a transaction to Solana, there's a brief delay before the transaction
 * is fully processed and the state is updated on-chain. This constant defines how long
 * to wait before invalidating React Query caches to ensure fresh data is fetched.
 * 
 * 2000ms (2 seconds) is a reasonable delay that balances:
 * - Ensuring transactions have time to be processed and finalized
 * - Not making users wait unnecessarily long for UI updates
 */
const TRANSACTION_PROCESSING_DELAY = 2000

/**
 * SUPPLY CHAIN PROGRAM ID HOOK
 * 
 * Returns the address of the deployed Solana program that handles supply chain operations.
 * This address is used to:
 * - Send transactions to the correct program
 * - Query accounts owned by the program
 * - Derive Program Derived Addresses (PDAs)
 * 
 * @returns {Address} The program's address on the Solana blockchain
 */
export function useSupplyChainProgramId() {
  return SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS
}

/**
 * SUPPLY CHAIN PROGRAM ACCOUNT QUERY
 * 
 * Queries the Solana blockchain to get information about the supply chain program itself.
 * This is useful for:
 * - Verifying the program is deployed and accessible
 * - Getting program metadata (executable data, owner, etc.)
 * - Health checking the program before attempting operations
 * 
 * The query is keyed by cluster and cluster version to ensure cache invalidation
 * when switching between different Solana clusters (devnet, testnet, mainnet).
 * 
 * @returns {UseQueryResult} React Query result containing program account info
 */
export function useSupplyChainProgram() {
  // Get RPC client and current cluster from wallet
  const { client, cluster } = useWalletUi()
  // Get the program's address
  const programId = useSupplyChainProgramId()
  // Get cluster version for cache keying
  const query = useClusterVersion()

  return useQuery({
    // Don't retry on failure - if program doesn't exist, we want to know immediately
    retry: false,
    // Unique key for caching - includes cluster and version for proper invalidation
    queryKey: ['get-program-account', { cluster, clusterVersion: query.data }],
    // Fetch the program account information from Solana RPC
    queryFn: () => client.rpc.getAccountInfo(programId).send(),
  })
}

/**
 * PRODUCT INITIALIZATION MUTATION
 * 
 * This mutation creates a new product in the supply chain system. It:
 * 
 * 1. TRANSACTION CREATION:
 *    - Builds a Solana transaction instruction using Anchor-generated code
 *    - Includes the product's serial number and description
 *    - Sets the current wallet as the product owner
 * 
 * 2. ACCOUNT CREATION:
 *    - Creates a new Product account on Solana with a Program Derived Address (PDA)
 *    - The PDA is derived from seeds including the owner's address and serial number
 *    - This ensures each owner can only create one product with a given serial number
 * 
 * 3. STATE MANAGEMENT:
 *    - Automatically invalidates React Query caches after successful creation
 *    - Shows success/error notifications to the user
 *    - Provides detailed error handling for common failure scenarios
 * 
 * @returns {UseMutationResult} React Query mutation for creating products
 */
export function useInitializeProductMutation() {
  // Get current cluster for cache invalidation
  const { cluster } = useWalletUi()
  // Query client for manual cache invalidation
  const queryClient = useQueryClient()
  // Get wallet signer for transaction authorization
  const signer = useWalletUiSigner()
  // Get transaction signing function
  const signAndSend = useWalletTransactionSignAndSend()

  return useMutation({
    /**
     * MUTATION FUNCTION - Core product creation logic
     * 
     * @param {Object} params - Product creation parameters
     * @param {string} params.serialNumber - Unique identifier for the product
     * @param {string} params.description - Human-readable product description
     * @returns {Promise} Transaction signature on success
     */
    mutationFn: async ({ serialNumber, description }: { serialNumber: string; description: string }) => {
      try {
        /**
         * CREATE INSTRUCTION
         * 
         * Uses Anchor-generated instruction builder to create a properly formatted
         * Solana transaction instruction. The instruction includes:
         * - Account references (product PDA, owner, system program)
         * - Instruction data (serial number, description, initial status)
         * - Required signers and permissions
         */
        const instruction = await getInitializeProductInstructionAsync({
          owner: signer,        // Wallet that will own the product
          serialNumber,         // Unique product identifier
          description,          // Product description
        })
        
        /**
         * SIGN AND SEND TRANSACTION
         * 
         * Takes the instruction and:
         * 1. Wraps it in a Solana transaction message
         * 2. Sets transaction lifetime using latest blockhash
         * 3. Signs the transaction with the user's wallet
         * 4. Submits it to the Solana network
         * 5. Returns the transaction signature
         */
        const result = await signAndSend(instruction, signer)
        return result
      } catch (error) {
        // Comprehensive error logging for debugging transaction failures
        console.error('Error in mutationFn:', error)
        console.error('Error type:', typeof error)
        console.error('Error constructor:', error?.constructor?.name)
        
        if (error instanceof Error) {
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
        }
        
        // Re-throw to trigger onError handler
        throw error
      }
    },

    /**
     * SUCCESS HANDLER
     * 
     * Called when the transaction is successfully processed. This handler:
     * 1. Shows a success notification with transaction details
     * 2. Waits for blockchain state to update
     * 3. Invalidates relevant React Query caches to trigger data refetch
     * 
     * @param {any} tx - Transaction signature and details
     */
    onSuccess: async (tx) => {
      // Show success notification with transaction link
      toastTx(tx)
      
      /**
       * TRANSACTION PROCESSING DELAY
       * 
       * Solana transactions go through several stages:
       * 1. Submitted to network
       * 2. Processed by validator
       * 3. Committed to blockchain
       * 4. Finalized (irreversible)
       * 
       * We wait before invalidating caches to ensure the new product data
       * is available when queries refetch.
       */
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_PROCESSING_DELAY))
      
      /**
       * CACHE INVALIDATION STRATEGY
       * 
       * Invalidate multiple query caches to ensure UI shows fresh data:
       * 1. Product list queries - to show the new product in lists
       * 2. Broad supply chain queries - catches any related data
       * 3. Force refetch - immediately gets fresh data instead of waiting
       */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'products', { cluster }] }),
        queryClient.invalidateQueries({ queryKey: ['supply_chain'] }), // Broader invalidation
        queryClient.refetchQueries({ queryKey: ['supply_chain', 'products', { cluster }] }) // Force refetch
      ])
    },

    /**
     * ERROR HANDLER
     * 
     * Provides user-friendly error messages for common failure scenarios.
     * Solana errors often come as hex codes that need to be translated to
     * meaningful messages for users.
     * 
     * @param {unknown} error - The error that occurred during mutation
     */
    onError: (error) => {
      console.error('Initialize product error:', error)
      let errorMessage = 'Failed to initialize product'
      
      if (error instanceof Error) {
        /**
         * SOLANA ERROR CODE MAPPING
         * 
         * Common Solana program errors and their meanings:
         * - 0x7d6/ConstraintSeeds: PDA derivation failed (account already exists)
         * - 0x1772/UnauthorizedAccess: Wallet doesn't have permission
         * - 0x1: Insufficient funds for transaction fees
         * - User rejected: User cancelled transaction in wallet
         * - Network errors: RPC connection or timeout issues
         */
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
      
      // Show error notification to user
      toast.error(errorMessage)
    },
  })
}

/**
 * EVENT LOGGING MUTATION
 * 
 * This mutation adds a new event to an existing product in the supply chain.
 * Events represent actions that happen to products over time (shipping, receiving, etc.).
 * 
 * KEY CONCEPTS:
 * 
 * 1. SEQUENTIAL EVENTS:
 *    - Each product maintains an event counter
 *    - Events are numbered sequentially (0, 1, 2, ...)
 *    - This creates an immutable audit trail
 * 
 * 2. PROGRAM DERIVED ADDRESSES FOR EVENTS:
 *    - Each event gets its own account on Solana
 *    - Event PDAs are derived from: ["event", product_address, event_index]
 *    - This makes events easy to find and prevents conflicts
 * 
 * 3. AUTHORIZATION:
 *    - Only the product owner can log events
 *    - This is enforced by the Solana program
 * 
 * @returns {UseMutationResult} React Query mutation for logging events
 */
export function useLogEventMutation() {
  // Invalidation function for product account queries
  const invalidateAccounts = useProductAccountsInvalidate()
  // Query client for manual cache management
  const queryClient = useQueryClient()
  // Wallet signer for transaction authorization
  const signer = useWalletUiSigner()
  // Transaction signing function
  const signAndSend = useWalletTransactionSignAndSend()
  // RPC client for blockchain queries
  const { client } = useWalletUi()
  // Supply chain program address
  const programId = useSupplyChainProgramId()

  return useMutation({
    /**
     * MUTATION FUNCTION - Core event logging logic
     * 
     * @param {Object} params - Event logging parameters
     * @param {Address} params.productAddress - Address of the product to log event for
     * @param {EventType} params.eventType - Type of event (Created, Shipped, Received, etc.)
     * @param {string} params.description - Human-readable event description
     * @returns {Promise} Object containing transaction signature and product address
     */
    mutationFn: async ({ 
      productAddress, 
      eventType, 
      description 
    }: { 
      productAddress: Address; 
      eventType: EventType; 
      description: string 
    }) => {
      /**
       * FETCH CURRENT PRODUCT STATE
       * 
       * Before logging an event, we need to know:
       * 1. The current event counter (to determine the next event index)
       * 2. That the product exists and is accessible
       * 3. The current product owner (for authorization)
       */
      const productAccount = await fetchProduct(client.rpc, productAddress)
      
      /**
       * DERIVE EVENT ACCOUNT ADDRESS
       * 
       * Program Derived Addresses (PDAs) are deterministic account addresses
       * derived from a set of seeds. For events, the seeds are:
       * 
       * 1. "event" - A constant string to identify event accounts
       * 2. product_address - Links the event to a specific product
       * 3. events_counter - The sequential index of this event
       * 
       * This derivation must match exactly what the Solana program expects,
       * or the transaction will fail with a ConstraintSeeds error.
       */
      const [eventAccountPDA] = await getProgramDerivedAddress({
        programAddress: programId,    // The supply chain program address
        seeds: [
          // Convert "event" string to bytes using TextEncoder for clarity
          getBytesEncoder().encode(new TextEncoder().encode("event")),
          // Product address as bytes
          getAddressEncoder().encode(productAddress),
          // Event counter as 64-bit little-endian integer
          getU64Encoder().encode(productAccount.data.eventsCounter),
        ],
      })

      /**
       * CREATE EVENT INSTRUCTION
       * 
       * Uses Anchor-generated instruction builder to create the transaction
       * instruction for logging an event. The instruction includes:
       * - Product account (to update event counter and status)
       * - Event account (new PDA to store event data)
       * - Signer (must be product owner)
       * - Event data (type and description)
       */
      const instruction = getLogEventInstruction({
        productAccount: productAddress,    // Product being updated
        eventAccount: eventAccountPDA,     // New event account address
        signer,                           // Current wallet (must be product owner)
        eventType,                        // Type of event being logged
        description,                      // Event description
      })
      
      /**
       * EXECUTE TRANSACTION
       * 
       * Sign and send the transaction, returning both the transaction signature
       * and the product address for use in the success handler.
       */
      return { tx: await signAndSend(instruction, signer), productAddress }
    },

    /**
     * SUCCESS HANDLER
     * 
     * After successful event logging:
     * 1. Show success notification
     * 2. Wait for blockchain state to update
     * 3. Invalidate related caches to show fresh data
     * 
     * @param {Object} result - Contains transaction details and product address
     */
    onSuccess: async ({ tx, productAddress }) => {
      // Show success notification with transaction link
      toastTx(tx)
      
      // Wait for transaction to be processed on-chain
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_PROCESSING_DELAY))
      
      /**
       * TARGETED CACHE INVALIDATION
       * 
       * Invalidate caches for:
       * 1. All product accounts (event counter changed)
       * 2. Events for this specific product (new event added)
       * 3. This specific product (status may have changed)
       */
      await Promise.all([
        invalidateAccounts(),
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'events', productAddress] }),
        queryClient.invalidateQueries({ queryKey: ['supply_chain', 'product', productAddress] })
      ])
    },

    /**
     * ERROR HANDLER
     * 
     * Shows a generic error message. Specific error handling is done in the UI
     * components that call this mutation (like authorization checks).
     */
    onError: () => toast.error('Failed to log event'),
  })
}

/**
 * OWNERSHIP TRANSFER MUTATION
 * 
 * This mutation transfers ownership of a product from the current owner to a new owner.
 * Only the current owner can initiate this transfer, and it's irreversible once completed.
 * 
 * Use cases:
 * - Selling products to customers
 * - Transferring between supply chain partners
 * - Moving products between different business units
 * 
 * @returns {UseMutationResult} React Query mutation for transferring ownership
 */
export function useTransferOwnershipMutation() {
  // Function to invalidate product account caches
  const invalidateAccounts = useProductAccountsInvalidate()
  // Transaction signing function
  const signAndSend = useWalletTransactionSignAndSend()
  // Current wallet signer (must be current owner)
  const signer = useWalletUiSigner()

  return useMutation({
    /**
     * MUTATION FUNCTION - Core ownership transfer logic
     * 
     * @param {Object} params - Transfer parameters
     * @param {Address} params.productAddress - Product to transfer
     * @param {Address} params.newOwner - Address of the new owner
     * @returns {Promise} Transaction signature
     */
    mutationFn: async ({ 
      productAddress, 
      newOwner 
    }: { 
      productAddress: Address; 
      newOwner: Address 
    }) => {
      /**
       * CREATE TRANSFER INSTRUCTION
       * 
       * Uses Anchor-generated instruction builder to create the ownership
       * transfer instruction. The Solana program will verify that:
       * 1. The current signer is the current product owner
       * 2. The new owner address is valid
       * 3. The product account exists
       */
      const instruction = getTransferOwnershipInstruction({
        productAccount: productAddress,   // Product being transferred
        currentOwner: signer,            // Current owner (must sign transaction)
        newOwner,                        // New owner address
      })
      
      // Sign and send the transaction
      return await signAndSend(instruction, signer)
    },

    /**
     * SUCCESS HANDLER
     * 
     * After successful ownership transfer:
     * 1. Show success notification
     * 2. Invalidate product caches (ownership data changed)
     */
    onSuccess: async (tx) => {
      // Show success notification
      toastTx(tx)
      // Invalidate all product account caches
      await invalidateAccounts()
    },

    /**
     * ERROR HANDLER
     * 
     * Shows error notification for failed transfers
     */
    onError: () => toast.error('Failed to transfer ownership'),
  })
}

/**
 * PRODUCT ACCOUNTS QUERY
 * 
 * This query fetches all products from the blockchain. It's a complex query that:
 * 
 * 1. DISCOVERS ACCOUNTS:
 *    - Queries all accounts owned by the supply chain program
 *    - Filters for Product accounts using discriminator matching
 *    - Handles various data encoding formats from Solana RPC
 * 
 * 2. BATCH FETCHING:
 *    - Gets account addresses first, then fetches full data
 *    - Uses parallel fetching for better performance
 *    - Handles empty results gracefully
 * 
 * 3. DATA PROCESSING:
 *    - Decodes base64-encoded account data
 *    - Validates account structure and discriminators
 *    - Returns properly typed Product objects
 * 
 * @returns {UseQueryResult} React Query result containing array of products
 */
export function useProductAccountsQuery() {
  // RPC client for blockchain queries
  const { client } = useWalletUi()
  // Supply chain program address
  const programId = useSupplyChainProgramId()

  return useQuery({
    // Cache key for this query
    queryKey: useProductAccountsQueryKey(),
    
    /**
     * QUERY FUNCTION - Fetches all products from blockchain
     * 
     * @returns {Promise<Product[]>} Array of product accounts
     */
    queryFn: async () => {
      try {
        /**
         * GET PROGRAM ACCOUNTS
         * 
         * Queries Solana for all accounts owned by the supply chain program.
         * This includes both Product accounts and Event accounts, so we need
         * to filter them by discriminator.
         * 
         * The 'base64' encoding is requested for efficiency - account data
         * comes back as base64 strings instead of byte arrays.
         */
        const programAccounts = await client.rpc.getProgramAccounts(programId, {
          encoding: 'base64'
        }).send()
        
        // Return empty array if no accounts found
        if (!programAccounts || programAccounts.length === 0) {
          return []
        }

        /**
         * FILTER FOR PRODUCT ACCOUNTS
         * 
         * Solana programs can own many different types of accounts. In our case:
         * - Product accounts (what we want)
         * - Event accounts (what we need to filter out)
         * 
         * We distinguish them using discriminators - unique 8-byte identifiers
         * at the beginning of each account's data.
         */
        const productAddresses = programAccounts
          .filter(account => {
            // Get account data in various possible formats
            const data = account.account.data
            if (!data) return false
            
            /**
             * HANDLE MULTIPLE DATA FORMATS
             * 
             * Solana RPC can return account data in several formats:
             * 1. [base64String, 'base64'] - Tuple format
             * 2. base64String - Direct string
             * 3. Uint8Array - Raw bytes
             * 4. number[] - Array of byte values
             * 
             * We need to handle all formats and convert to Uint8Array
             * for discriminator comparison.
             */
            let dataBytes: Uint8Array
            if (Array.isArray(data) && data.length === 2 && data[1] === 'base64') {
              // Tuple format: [base64String, 'base64']
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
              // Already in correct format
              dataBytes = data
            } else if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
              // Array of numbers
              dataBytes = new Uint8Array(data as number[])
            } else {
              // Unknown format
              return false
            }
            
            // Account must have at least 8 bytes for discriminator
            if (dataBytes.length < 8) return false
            
            /**
             * DISCRIMINATOR MATCHING
             * 
             * Compare the first 8 bytes of account data with the Product
             * discriminator. This uniquely identifies Product accounts
             * vs other account types.
             */
            return dataBytes.slice(0, 8).every((byte, i) => byte === PRODUCT_DISCRIMINATOR[i])
          })
          // Extract just the account addresses
          .map(account => account.pubkey)

        // Return empty array if no Product accounts found
        if (productAddresses.length === 0) {
          return []
        }

        /**
         * BATCH FETCH PRODUCT DATA
         * 
         * Now that we have the addresses of all Product accounts,
         * fetch their full data using the Anchor-generated client.
         * This provides properly typed Product objects with all fields.
         */
        return await fetchAllProduct(client.rpc, productAddresses)
      } catch (error) {
        // Log error but return empty array to prevent UI crashes
        console.error('Error fetching product accounts:', error)
        return []
      }
    },
  })
}

/**
 * SINGLE PRODUCT QUERY
 * 
 * Fetches data for a specific product by its address. This is used when
 * you need detailed information about one product, such as in product
 * detail views or event logging forms.
 * 
 * @param {Address} address - The product's account address
 * @returns {UseQueryResult} React Query result containing the product data
 */
export function useProductQuery(address: Address) {
  // RPC client for blockchain queries
  const { client } = useWalletUi()

  return useQuery({
    // Unique cache key including the product address
    queryKey: ['supply_chain', 'product', address],
    // Fetch the specific product using Anchor client
    queryFn: async () => await fetchProduct(client.rpc, address),
    // Only run query if address is provided
    enabled: !!address,
  })
}

/**
 * PRODUCT EVENTS QUERY
 * 
 * Fetches all events for a specific product. This is complex because:
 * 
 * 1. SEQUENTIAL DISCOVERY:
 *    - First fetch the product to get event count
 *    - Generate addresses for all events (0 to count-1)
 *    - Fetch all events in parallel
 * 
 * 2. PDA DERIVATION:
 *    - Each event has a unique PDA derived from product address and index
 *    - Must match the derivation logic used when creating events
 * 
 * 3. ORDERING:
 *    - Events are returned in chronological order (by event index)
 *    - This maintains the audit trail sequence
 * 
 * @param {Address} productAddress - Address of the product to get events for
 * @returns {UseQueryResult} React Query result containing array of events
 */
export function useProductEventsQuery(productAddress: Address) {
  // RPC client for blockchain queries
  const { client } = useWalletUi()
  // Supply chain program address
  const programId = useSupplyChainProgramId()

  return useQuery({
    // Unique cache key for this product's events
    queryKey: ['supply_chain', 'events', productAddress],
    
    /**
     * QUERY FUNCTION - Fetches all events for a product
     * 
     * @returns {Promise<Event[]>} Array of events in chronological order
     */
    queryFn: async () => {
      try {
        /**
         * GET EVENT COUNT
         * 
         * First, fetch the product to determine how many events exist.
         * The product maintains an event counter that increments with
         * each logged event.
         */
        const product = await fetchProduct(client.rpc, productAddress)
        const eventsCount = Number(product.data.eventsCounter)
        
        // Return empty array if no events exist
        if (eventsCount === 0) {
          return []
        }

        /**
         * DERIVE ALL EVENT ADDRESSES
         * 
         * For each event index (0 to eventsCount-1), derive the PDA
         * where that event's data is stored. This must use the same
         * seed derivation as the event logging function.
         */
        const eventPromises = []
        for (let i = 0; i < eventsCount; i++) {
          // Derive PDA for event at index i
          const [eventPDA] = await getProgramDerivedAddress({
            programAddress: programId,
            seeds: [
              // "event" string as bytes
              getBytesEncoder().encode(new TextEncoder().encode("event")),
              // Product address
              getAddressEncoder().encode(productAddress),
              // Event index as 64-bit integer
              getU64Encoder().encode(BigInt(i)),
            ],
          })
          // Add fetch promise to array
          eventPromises.push(fetchSupplyChainEvent(client.rpc, eventPDA))
        }

        /**
         * PARALLEL FETCH AND SORT
         * 
         * Fetch all events in parallel for better performance, then
         * sort by event index to maintain chronological order.
         */
        const events = await Promise.all(eventPromises)
        
        // Sort events by their index (which represents creation order)
        return events.sort((a, b) => Number(a.data.eventIndex) - Number(b.data.eventIndex))
      } catch (error) {
        // Log error but return empty array to prevent UI crashes
        console.error('Error fetching events:', error)
        return []
      }
    },
    // Only run query if product address is provided
    enabled: !!productAddress,
  })
}

/**
 * UTILITY FUNCTIONS FOR CACHE MANAGEMENT
 * 
 * These functions provide reusable cache invalidation logic that can be
 * shared across different mutations and components.
 */

/**
 * PRODUCT ACCOUNTS INVALIDATION HOOK
 * 
 * Returns a function that invalidates the product accounts query cache.
 * This is used after mutations that affect the product list (create, delete, etc.).
 * 
 * @returns {Function} Function to invalidate product accounts cache
 */
function useProductAccountsInvalidate() {
  // Query client for cache management
  const queryClient = useQueryClient()
  // Get the cache key for product accounts
  const queryKey = useProductAccountsQueryKey()

  // Return invalidation function
  return () => queryClient.invalidateQueries({ queryKey })
}

/**
 * PRODUCT ACCOUNTS QUERY KEY
 * 
 * Generates the cache key used for product accounts queries. The key includes
 * the cluster information to ensure cache separation between different Solana
 * environments (devnet, testnet, mainnet).
 * 
 * @returns {Array} React Query cache key
 */
function useProductAccountsQueryKey() {
  // Get current cluster from wallet
  const { cluster } = useWalletUi()
  // Return structured cache key
  return ['supply_chain', 'products', { cluster }]
}

/**
 * FORM STATE MANAGEMENT HOOKS
 * 
 * These hooks provide reusable form state management for common operations
 * in the supply chain application. They handle local state, validation,
 * and form reset functionality.
 */

/**
 * CREATE PRODUCT FORM HOOK
 * 
 * Manages form state for creating new products. Provides:
 * - Serial number input state
 * - Description input state
 * - Form validation (both fields required)
 * - Reset functionality
 * 
 * @returns {Object} Form state and handlers
 */
export function useCreateProductForm() {
  // Local state for form fields
  const [serialNumber, setSerialNumber] = useState('')
  const [description, setDescription] = useState('')

  /**
   * RESET FUNCTION
   * 
   * Clears all form fields back to initial state.
   * Used after successful submission or user cancellation.
   */
  const reset = () => {
    setSerialNumber('')
    setDescription('')
  }

  // Return form state and handlers
  return {
    serialNumber,        // Current serial number value
    setSerialNumber,     // Function to update serial number
    description,         // Current description value
    setDescription,      // Function to update description
    reset,              // Function to reset form
    // Form is valid if both fields have non-empty content
    isValid: serialNumber.trim().length > 0 && description.trim().length > 0
  }
}

/**
 * LOG EVENT FORM HOOK
 * 
 * Manages form state for logging events on products. Provides:
 * - Event type selection (Created, Shipped, Received, etc.)
 * - Event description input
 * - Form validation (description required)
 * - Reset functionality with sensible defaults
 * 
 * @returns {Object} Form state and handlers
 */
export function useLogEventForm() {
  // Local state for form fields
  const [eventType, setEventType] = useState<EventType>(EventType.Created)
  const [description, setDescription] = useState('')

  /**
   * RESET FUNCTION
   * 
   * Resets form to initial state:
   * - Event type back to 'Created' (most common)
   * - Description cleared
   */
  const reset = () => {
    setEventType(EventType.Created)
    setDescription('')
  }

  // Return form state and handlers
  return {
    eventType,          // Currently selected event type
    setEventType,       // Function to update event type
    description,        // Current description value
    setDescription,     // Function to update description
    reset,             // Function to reset form
    // Form is valid if description has content
    isValid: description.trim().length > 0
  }
}

/**
 * TYPE EXPORTS
 * 
 * Re-export commonly used types from the Anchor client for convenience.
 * This allows components to import types from this centralized location
 * instead of needing to know about the Anchor client structure.
 */
export { EventType, ProductStatus }