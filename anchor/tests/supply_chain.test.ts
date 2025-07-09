import {
  createSolanaClient,
  signTransactionMessageWithSigners,
  createTransaction,
  KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
} from 'gill'
import { loadKeypairSignerFromFile } from 'gill/node'
import { getInitializeProductInstructionAsync } from '../src/client/js/generated/instructions/initializeProduct'
import { SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS } from '../src/client/js/generated/programs'
import { fetchProduct } from '../src/client/js/generated/accounts'

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
       * Aend and wait for execution
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

  it.skip('Increment SupplyChain', async () => {
    expect(true).toBe(true)
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
