import {
  createSolanaClient,
  signTransactionMessageWithSigners,
  createTransaction,
  KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  generateKeyPairSigner,
  lamports,
  LAMPORTS_PER_SOL,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  airdropFactory,
  Address,
} from 'gill'
import { getInitializeProductInstructionAsync } from '../src/client/js/generated/instructions/initializeProduct'
import { SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS } from '../src/client/js/generated/programs'
import { fetchProduct, fetchSupplyChainEvent } from '../src/client/js/generated/accounts'
import { getLogEventInstruction } from '../src/client/js/generated/instructions'
import { EventType } from '../src/client/js/generated/types'

describe('supply_chain_events', () => {
  const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'localnet',
  })

  let owner1: KeyPairSigner | undefined = undefined
  let owner2: KeyPairSigner | undefined = undefined
  let productAccountAddress: Address | undefined

  beforeAll(async () => {
    // Generate multiple keypairs for testing
    owner1 = await generateKeyPairSigner()
    owner2 = await generateKeyPairSigner()

    const rpc = createSolanaRpc('http://localhost:8899')
    const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900')

    // Get some initial airdrop for transaction funding
    await Promise.all([
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner1.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 6)),
        commitment: 'confirmed',
      }),
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner2.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 6)),
        commitment: 'confirmed',
      }),
    ])

    // Initialize product to be used in tests
    if (owner1) {
      const serialNumber = 'test-for-events'
      const description = 'Test Product'
      const initProduct = await getInitializeProductInstructionAsync({
        owner: owner1,
        serialNumber,
        description,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [initProduct],
        latestBlockhash,
      })

      /**
       * Sign the transaction with the provided `signer` when it was created
       */
      const signedTransaction = await signTransactionMessageWithSigners(tx)

      /**
       * And and wait for execution
       */
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      /**
       * Get the PDA adress for the product
       */
      const [_productAccountAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(owner1.address), serialNumber],
      })
      productAccountAddress = _productAccountAddress
    }
  })

  it('Creates an event', async () => {
    expect(owner1).not.toBe(undefined)
    expect(productAccountAddress).not.toBe(undefined)

    if (owner1 && productAccountAddress) {
      const eventType: EventType = EventType.Created
      const description = 'Test Event 1'

      const productAccount = await fetchProduct(rpc, productAccountAddress)

      const [productEventAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new TextEncoder().encode('event')),
          getAddressEncoder().encode(productAccount.address),
          getU64Encoder().encode(productAccount.data.eventsCounter),
        ],
      })

      const logEventInstruction = getLogEventInstruction({
        productAccount: productAccount.address,
        eventAccount: productEventAddress,
        description,
        eventType,
        signer: owner1,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      /**
       * Sign the transaction with the provided `signer` when it was created
       */
      const signedTransaction = await signTransactionMessageWithSigners(tx)

      /**
       * And and wait for execution
       */
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      /**
       * Verify the counter in the product has been incremented
       */
      const newProductAccount = await fetchProduct(rpc, productAccount.address)
      expect(newProductAccount.data.eventsCounter).toBe(1n)

      /**
       * Verify the event
       */
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        eventIndex: 0n,
      })
    }
  })

  it('Only owner can create events', async () => {
    expect(owner1).not.toBe(undefined)
    expect(owner2).not.toBe(undefined)
    expect(productAccountAddress).not.toBe(undefined)

    if (owner1 && owner2 && productAccountAddress) {
      const eventType: EventType = EventType.Created
      const description = 'Test Event 1'
      const productAccount = await fetchProduct(rpc, productAccountAddress)

      const [productEventAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new TextEncoder().encode('event')),
          getAddressEncoder().encode(productAccount.address),
          getU64Encoder().encode(productAccount.data.eventsCounter),
        ],
      })

      const logEventInstruction = getLogEventInstruction({
        productAccount: productAccount.address,
        eventAccount: productEventAddress,
        description,
        eventType,
        signer: owner2,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      /**
       * Sign the transaction with the provided `signer` when it was created
       */
      const signedTransaction = await signTransactionMessageWithSigners(tx)

      /**
       * And wait for execution - this should fail
       */
      try {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment: 'confirmed',
        })
        // If we reach this point, the test should fail
        fail('Expected transaction to fail due to unauthorized access')
      } catch (error) {
        // We expect this to fail due to authorization check
        expect(error).toBeDefined()
        expect(String(error.context.logs)).toContain('Error Message: Unauthorized access')
      }
    }
  })
})
