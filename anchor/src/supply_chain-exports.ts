// Here we export some useful types and functions for interacting with the Anchor program.
import { Account, address, getBase58Decoder, SolanaClient } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { getProgramAccountsDecoded } from './helpers/get-program-accounts-decoded'
import { SupplyChain, SUPPLY_CHAIN_DISCRIMINATOR, SUPPLY_CHAIN_PROGRAM_ADDRESS, getSupplyChainDecoder } from './client/js'
import SupplyChainIDL from '../target/idl/supply_chain.json'

export type SupplyChainAccount = Account<SupplyChain, string>

// Re-export the generated IDL and type
export { SupplyChainIDL }

// This is a helper function to get the program ID for the SupplyChain program depending on the cluster.
export function getSupplyChainProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
      // This is the program ID for the SupplyChain program on devnet and testnet.
      return address('6z68wfurCMYkZG51s1Et9BJEd9nJGUusjHXNt4dGbNNF')
    case 'solana:mainnet':
    default:
      return SUPPLY_CHAIN_PROGRAM_ADDRESS
  }
}

export * from './client/js'

export function getSupplyChainProgramAccounts(rpc: SolanaClient['rpc']) {
  return getProgramAccountsDecoded(rpc, {
    decoder: getSupplyChainDecoder(),
    filter: getBase58Decoder().decode(SUPPLY_CHAIN_DISCRIMINATOR),
    programAddress: SUPPLY_CHAIN_PROGRAM_ADDRESS,
  })
}
