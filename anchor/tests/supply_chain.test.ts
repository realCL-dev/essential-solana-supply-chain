import { address, createSolanaClient, signTransactionMessageWithSigners, createTransaction, KeyPairSigner } from 'gill'
import { loadKeypairSignerFromFile } from 'gill/node'
import { buildTransferTokensTransaction, TOKEN_PROGRAM_ADDRESS } from 'gill/programs/token'
import {
  getInitializeProductInstruction,
  getInitializeProductInstructionAsync,
} from '../src/client/js/generated/instructions/initializeProduct'
import { before } from 'node:test'

describe('supply_chain', () => {
  // TODO: Implement tests for the supply_chain program based on the Codama generated client.
  // Use tests in `legacy/legacy-next-tailwind-supply_chain/anchor/tests/supply_chain.test.ts` as a reference.

  const { rpc, sendAndConfirmTransaction } = createSolanaClient({
    urlOrMoniker: 'devnet',
  })
  let signer: KeyPairSigner | undefined = undefined

  beforeAll(async () => {
    signer = await loadKeypairSignerFromFile()

    // const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()

    // const mint = address('HwxZNMkZbZMeiu9Xnmc6Rg8jYgNsJB47jwabHGUebW4F')
    // const tokenProgram = TOKEN_PROGRAM_ADDRESS // use the correct program for the `mint`

    // const destination = address('7sZoCrE3cGgEpNgxcPnGffDeWfTewKnk6wWdLxmYA7Cy')

    console.table([
      {
        id: 'signer',
        address: signer?.address,
      },
    ])
  })

  it('Initialize SupplyChain', async () => {
    expect(signer).not.toBe(undefined)

    if (signer) {
      const serialNumber = '!23'
      const description = 'My Product'
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
      console.log('Transaction:')
      console.log(tx)

      /**
       * Sign the transaction with the provided `signer` when it was created
       */
      const signedTransaction = await signTransactionMessageWithSigners(tx)
      console.log('Transaction:')
      console.log(signedTransaction)
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
