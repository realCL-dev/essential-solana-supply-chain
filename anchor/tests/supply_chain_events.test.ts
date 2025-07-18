import {
  createSolanaClient,
  signTransactionMessageWithSigners,
  createTransaction,
  KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  getUtf8Encoder,
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
  let owner3: KeyPairSigner | undefined = undefined
  let productAccountAddress: Address
  let productWithStagesAddress: Address

  beforeAll(async () => {
    // Generate multiple keypairs for testing
    owner1 = await generateKeyPairSigner()
    owner2 = await generateKeyPairSigner()
    owner3 = await generateKeyPairSigner()

    const rpc = createSolanaRpc('http://localhost:8899')
    const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900')

    // Get some initial airdrop for transaction funding
    await Promise.all([
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner1.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 10)),
        commitment: 'confirmed',
      }),
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner2.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 10)),
        commitment: 'confirmed',
      }),
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner3.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 10)),
        commitment: 'confirmed',
      }),
    ])

    // Initialize product without stages for basic tests
    if (owner1) {
      const serialNumber = 'test-for-events'
      const description = 'Test Product'

      const [_productAccountAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(owner1.address), getUtf8Encoder().encode(serialNumber)],
      })
      productAccountAddress = _productAccountAddress

      const initProduct = await getInitializeProductInstructionAsync({
        productAccount: productAccountAddress,
        owner: owner1,
        serialNumber,
        description,
        stages: null,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [initProduct],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })
    }

    // Initialize product with stages for stage-based tests
    if (owner1 && owner2 && owner3) {
      const serialNumber = 'staged-product-events'
      const description = 'Test Product with Stages'
      const stages = [
        {
          name: 'Farm Stage',
          owner: owner1.address,
          completed: false,
        },
        {
          name: 'Factory Stage',
          owner: owner2.address,
          completed: false,
        },
        {
          name: 'Delivery Stage',
          owner: owner3.address,
          completed: false,
        },
      ]

      const [_productWithStagesAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(owner1.address), getUtf8Encoder().encode(serialNumber)],
      })
      productWithStagesAddress = _productWithStagesAddress

      const initProduct = await getInitializeProductInstructionAsync({
        productAccount: productWithStagesAddress,
        owner: owner1,
        serialNumber,
        description,
        stages,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [initProduct],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })
    }
  })

  it('Creates an event for product without stages', async () => {
    expect(owner1).not.toBe(undefined)
    expect(productAccountAddress).not.toBe(undefined)

    if (owner1 && productAccountAddress) {
      const eventType: EventType = EventType.Ongoing
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
        eventType,
        description,
        signer: owner1,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      // Verify the counter in the product has been incremented
      const newProductAccount = await fetchProduct(rpc, productAccount.address)
      expect(newProductAccount.data.eventsCounter).toBe(1n)

      // Verify the event
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        eventIndex: 0n,
      })
    }
  })

  it('Only product owner can create events for products without stages', async () => {
    expect(owner1).not.toBe(undefined)
    expect(owner2).not.toBe(undefined)
    expect(productAccountAddress).not.toBe(undefined)

    if (owner1 && owner2 && productAccountAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Unauthorized Event'
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
        signer: owner2, // Different owner
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)

      try {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment: 'confirmed',
        })
        fail('Expected transaction to fail due to unauthorized access')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error.context.logs)).toContain('Error Message: Unauthorized access')
      }
    }
  })

  it('Creates events for products with stages - first stage owner', async () => {
    expect(owner1).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner1 && productWithStagesAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Farm stage started'
      const stageName = 'Farm Stage' // This will be ignored, current stage name will be used

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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
        eventType,
        description,
        signer: owner1, // First stage owner
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner1,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      // Verify the event was created with the current stage name
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        stageName,
        eventIndex: 0n,
      })
    }
  })

  it('Only current stage owner can create events for staged products', async () => {
    expect(owner2).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner2 && productWithStagesAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Unauthorized factory event'
      const stageName = 'Factory Stage'
      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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
        signer: owner2, // Factory stage owner, but not current stage
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)

      try {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment: 'confirmed',
        })
        fail('Expected transaction to fail due to unauthorized access')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error.context.logs)).toContain('Error Message: Unauthorized access')
      }
    }
  })

  it('Completes a stage and moves to next stage', async () => {
    expect(owner1).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner1 && productWithStagesAddress) {
      const eventType: EventType = EventType.Complete
      const description = 'Farm stage completed'
      const stageName = 'Farm Stage'

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      // Verify the stage was completed and moved to next stage
      const updatedProductAccount = await fetchProduct(rpc, productWithStagesAddress)
      expect(updatedProductAccount.data.stages[0].completed).toBe(true)
      expect(updatedProductAccount.data.currentStageIndex).toBe(1) // Moved to next stage

      // Verify the event
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        stageName: 'Farm Stage',
      })
    }
  })

  it('Cannot add events to completed stages', async () => {
    expect(owner2).not.toBe(undefined) // Use owner2 instead of owner1
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner2 && productWithStagesAddress) {
      // First, complete the current stage (Factory Stage)
      const completeEventType: EventType = EventType.Complete
      const completeDescription = 'Factory stage completed'
      const completeStageName = 'Factory Stage'

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

      const [completeEventAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new TextEncoder().encode('event')),
          getAddressEncoder().encode(productAccount.address),
          getU64Encoder().encode(productAccount.data.eventsCounter),
        ],
      })

      const completeEventInstruction = getLogEventInstruction({
        productAccount: productAccount.address,
        eventAccount: completeEventAddress,
        description: completeDescription,
        eventType: completeEventType,
        signer: owner2,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const completeTx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [completeEventInstruction],
        latestBlockhash,
      })

      const signedCompleteTransaction = await signTransactionMessageWithSigners(completeTx)
      await sendAndConfirmTransaction(signedCompleteTransaction, {
        commitment: 'confirmed',
      })

      // Now try to add another event to the same (now completed) stage
      const eventType: EventType = EventType.Ongoing
      const description = 'Trying to add to completed stage'
      const stageName = 'Factory Stage'

      const updatedProductAccount = await fetchProduct(rpc, productWithStagesAddress)

      const [productEventAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          getBytesEncoder().encode(new TextEncoder().encode('event')),
          getAddressEncoder().encode(updatedProductAccount.address),
          getU64Encoder().encode(updatedProductAccount.data.eventsCounter),
        ],
      })

      const logEventInstruction = getLogEventInstruction({
        productAccount: updatedProductAccount.address,
        eventAccount: productEventAddress,
        description,
        eventType,
        signer: owner2, // Same owner, but stage is now completed
      })

      const { value: latestBlockhash2 } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [logEventInstruction],
        latestBlockhash: latestBlockhash2,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)

      try {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment: 'confirmed',
        })
        fail('Expected transaction to fail because stage is completed')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error.context.logs)).toContain('Error Message: Unauthorized access')
        // Note: We expect UnauthorizedAccess because the current stage moved to Delivery Stage (owner3)
      }
    }
  })

  it('Third stage owner can now create events after factory completion', async () => {
    expect(owner3).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner3 && productWithStagesAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Delivery stage started'
      const stageName = 'Delivery Stage'

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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
        signer: owner3, // Delivery stage owner, now current stage
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner3,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      // Verify the event was created
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        stageName: 'Delivery Stage',
      })

      // Verify we're on the delivery stage
      const updatedProductAccount = await fetchProduct(rpc, productWithStagesAddress)
      expect(updatedProductAccount.data.currentStageIndex).toBe(2) // Delivery stage
      expect(updatedProductAccount.data.stages[2].completed).toBe(false) // Not completed yet
    }
  })

  it('Can add multiple events to the current delivery stage', async () => {
    expect(owner3).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner3 && productWithStagesAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Delivery stage progress update'
      const stageName = 'Delivery Stage'

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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
        signer: owner3, // Delivery stage owner
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner3,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)
      await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
      })

      // Verify the second event was created for the delivery stage
      const productEvent = await fetchSupplyChainEvent(rpc, productEventAddress)
      expect(productEvent.data).toMatchObject({
        product: productAccount.address,
        eventType,
        description,
        stageName: 'Delivery Stage',
      })

      // Verify events counter increased but stage is still the same
      const updatedProductAccount = await fetchProduct(rpc, productWithStagesAddress)
      expect(updatedProductAccount.data.currentStageIndex).toBe(2) // Still on delivery stage
      expect(updatedProductAccount.data.stages[2].completed).toBe(false) // Still not completed
    }
  })

  it('Previous stage owners cannot create events after their stage is completed', async () => {
    expect(owner2).not.toBe(undefined)
    expect(productWithStagesAddress).not.toBe(undefined)

    if (owner2 && productWithStagesAddress) {
      const eventType: EventType = EventType.Ongoing
      const description = 'Trying to add to completed factory stage'
      const stageName = 'Factory Stage'

      const productAccount = await fetchProduct(rpc, productWithStagesAddress)

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
        signer: owner2, // Factory stage owner, but current stage is delivery
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: owner2,
        instructions: [logEventInstruction],
        latestBlockhash,
      })

      const signedTransaction = await signTransactionMessageWithSigners(tx)

      try {
        await sendAndConfirmTransaction(signedTransaction, {
          commitment: 'confirmed',
        })
        fail('Expected transaction to fail due to unauthorized access')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error.context.logs)).toContain('Error Message: Unauthorized access')
      }
    }
  })
})
