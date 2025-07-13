import {
  createSolanaClient,
  signTransactionMessageWithSigners,
  createTransaction,
  KeyPairSigner,
  getProgramDerivedAddress,
  getAddressEncoder,
  generateKeyPairSigner,
  LAMPORTS_PER_SOL,
  lamports,
  airdropFactory,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from 'gill'
import { getInitializeProductInstructionAsync } from '../src/client/js/generated/instructions/initializeProduct'
import { SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS } from '../src/client/js/generated/programs'
import { fetchProduct } from '../src/client/js/generated/accounts'

describe('supply_chain', () => {
  const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'localnet',
  })

  let owner1: KeyPairSigner | undefined = undefined

  beforeAll(async () => {
    // Generate multiple keypairs for testing
    owner1 = await generateKeyPairSigner()

    const rpc = createSolanaRpc('http://localhost:8899')
    const rpcSubscriptions = createSolanaRpcSubscriptions('ws://localhost:8900')

    // Get some initial airdrop for transaction funding
    await Promise.all([
      airdropFactory({ rpc, rpcSubscriptions })({
        recipientAddress: owner1.address,
        lamports: lamports(BigInt(LAMPORTS_PER_SOL * 6)),
        commitment: 'confirmed',
      }),
    ])
  })

  it('Initialize Product', async () => {
    expect(owner1).not.toBe(undefined)

    if (owner1) {
      const serialNumber = '12345'
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
       * Sign the transaction with the provided `owner1`
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
      const [supplyChainAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: ['product', getAddressEncoder().encode(owner1.address), serialNumber],
      })

      /**
       * Fetch product and compare to expected values
       */

      const productAccount = await fetchProduct(rpc, supplyChainAddress)
      const product = productAccount.data

      expect(product).toMatchObject({
        owner: owner1.address,
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
})
