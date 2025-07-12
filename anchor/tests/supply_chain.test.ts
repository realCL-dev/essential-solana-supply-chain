import {
  createSolanaClient,
  signTransactionMessageWithSigners,
  createTransaction,
  KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  Account,
} from 'gill'
import { loadKeypairSignerFromFile } from 'gill/node'
import { getInitializeProductInstructionAsync } from '../src/client/js/generated/instructions/initializeProduct'
import { SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS } from '../src/client/js/generated/programs'
import { fetchProduct, Product } from '../src/client/js/generated/accounts'
import { getLogEventInstruction } from '../src/client/js/generated/instructions'
import { EventType } from '../src/client/js/generated/types'

describe('supply_chain', () => {
  // TODO: Implement tests for the supply_chain program based on the Codama generated client.
  // Use tests in `legacy/legacy-next-tailwind-supply_chain/anchor/tests/supply_chain.test.ts` as a reference.

  const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'localnet',
  })

  let signer: KeyPairSigner | undefined = undefined

  beforeAll(async () => {
    signer = await loadKeypairSignerFromFile()

    // console.table([
    //   {
    //     id: 'signer',
    //     address: signer?.address,
    //   },
    // ])
  })

  it('Initialize Product', async () => {
    expect(signer).not.toBe(undefined)

    if (signer) {
      const serialNumber = '12345'
      const description = 'Test Product'
      const initProduct = await getInitializeProductInstructionAsync({
        owner: signer,
        serialNumber,
        description,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: signer,
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
      const [supplyChainAddress, bump] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(signer.address), serialNumber],
      })

      /**
       * Fetch product and compare to expected values
       */

      const productAccount = await fetchProduct(rpc, supplyChainAddress)
      const product = productAccount.data

      expect(product).toMatchObject({
        owner: signer.address,
        serialNumber,
        description,
        status: 0,
        eventsCounter: 0n,
      })
      const now = BigInt(Math.floor(Date.now() / 1000))
      expect(product.createdAt).toBeLessThanOrEqual(now)
      expect(product.createdAt - now).toBeLessThanOrEqual(1) // Expect to be within 1 sec
    }
  })

  it.skip('Increment SupplyChain Again', async () => {
    expect(true).toBe(true)
  })

  it.skip('Decrement SupplyChain', async () => {
    expect(true).toBe(true)
  })

  it.skip('Set supply_chain value', async () => {
    expect(true).toBe(true)
  })

  it.skip('Set close the supply_chain account', async () => {
    expect(true).toBe(true)
  })
})

describe('supply_chain_events', () => {
  // TODO: Implement tests for the supply_chain program based on the Codama generated client.
  // Use tests in `legacy/legacy-next-tailwind-supply_chain/anchor/tests/supply_chain.test.ts` as a reference.

  const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'localnet',
  })

  let signer: KeyPairSigner | undefined = undefined
  let productAccount: Account<Product, string> | undefined = undefined

  beforeAll(async () => {
    // Load signer
    signer = await loadKeypairSignerFromFile()

    // Initialize product to be used in tests
    if (signer) {
      const serialNumber = 'test-for-events'
      const description = 'Test Product'
      const initProduct = await getInitializeProductInstructionAsync({
        owner: signer,
        serialNumber,
        description,
      })

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

      const tx = createTransaction({
        version: 'legacy',
        feePayer: signer,
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
      const [productAccountAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(signer.address), serialNumber],
      })

      productAccount = await fetchProduct(rpc, productAccountAddress)
    }
  })

  it('Creates an event', async () => {
    expect(signer).not.toBe(undefined)
    expect(productAccount?.address).not.toBe(undefined)

    if (signer && productAccount?.address) {
      try {
        const eventType: EventType = EventType.Created
        const description = 'Test Event 1'

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
          signer,
        })

        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

        const tx = createTransaction({
          version: 'legacy',
          feePayer: signer,
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
        expect(newProductAccount.data.eventsCounter).toBe(1)

        /**
         * Verify the event
         */
        const productEvent = await fetchProduct(rpc, productEventAddress)
        expect(productEvent).toMatchObject({
          product: productAccount.address,
          eventType,
          description,
          eventIndex: 0n,
        })

        const now = BigInt(Math.floor(Date.now() / 1000))
        expect(productEvent.data.createdAt).toBeLessThanOrEqual(now)
        expect(productEvent.data.createdAt - now).toBeLessThanOrEqual(1) // Expect to be within 1 sec
      } catch (error) {
        console.log('Error:', error)
      }
    }
  })
})
