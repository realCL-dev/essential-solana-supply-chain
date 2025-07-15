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
  getBytesEncoder,
  addEncoderSizePrefix,
  getUtf8Encoder,
  getU32Encoder,
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

      // PDA seeds should use raw bytes, not length-prefixed serialization.
      // Instead of using getInitializeProductInstructionAsync, manually provide the correct productAccount
      const [productAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          'product',
          getAddressEncoder().encode(owner1.address),
          getUtf8Encoder().encode(serialNumber), // Correct: raw UTF-8 bytes
        ],
      })

      const initProduct = await getInitializeProductInstructionAsync({
        productAccount: productAddress,
        owner: owner1,
        serialNumber,
        description,
        stages: null, // No stages for this test
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
       * Fetch product and compare to expected values
       */

      const productAccount = await fetchProduct(rpc, productAddress)
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

  it('Initialize Product with stages', async () => {
    expect(owner1).not.toBe(undefined)

    if (owner1) {
      const serialNumber = 'StagedProduct123'
      const description = 'Test Product with Stages'
      const stages = [
        {
          name: 'Farm Stage',
          owner: owner1.address, // or another valid wallet address
          completed: false,
        },
        {
          name: 'Factory Stage',
          owner: owner1.address, // or another valid wallet address
          completed: false,
        },
        {
          name: 'Receiver Stage',
          owner: owner1.address, // or another valid wallet address
          completed: false,
        },
      ]

      // PDA seeds should use raw bytes, not length-prefixed serialization.
      const [productAddress] = await getProgramDerivedAddress({
        programAddress: SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS,
        seeds: [
          'product',
          getAddressEncoder().encode(owner1.address),
          getUtf8Encoder().encode(serialNumber), // Correct: raw UTF-8 bytes
        ],
      })

      const initProduct = await getInitializeProductInstructionAsync({
        productAccount: productAddress,
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
       * Fetch product and compare to expected values
       */

      const productAccount = await fetchProduct(rpc, productAddress)
      const product = productAccount.data

      expect(product).toMatchObject({
        owner: owner1.address,
        serialNumber,
        description,
        status: 0,
        eventsCounter: 0n,
      })

      expect(product.stages).toBeDefined()
      expect(product.stages).toHaveLength(3)

      const now = BigInt(Math.floor(Date.now() / 1000))
      expect(product.createdAt).toBeLessThanOrEqual(now)
      expect(product.createdAt - now).toBeLessThanOrEqual(1) // Expect to be within 1 sec
    }
  })
})
