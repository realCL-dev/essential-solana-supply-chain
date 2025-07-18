// Here we export some useful types and functions for interacting with the Anchor program.
import { Account, address, Address, SolanaClient } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { Product, SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS, fetchAllProduct } from './client/js'
import SupplyChainProgramIDL from '../target/idl/supply_chain_program.json'

export type ProductAccount = Account<Product, string>

// Re-export the generated IDL and type
export { SupplyChainProgramIDL }

// This is a helper function to get the program ID for the SupplyChain program depending on the cluster.
export function getSupplyChainProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
      // Use the same program ID for all clusters in MVP
      return address('AiNohysKLFRjwxjsw4Rmg5t5vm6R9wEL6qQxjDtuxfcc')
    case 'solana:mainnet':
    default:
      return SUPPLY_CHAIN_PROGRAM_PROGRAM_ADDRESS
  }
}

export * from './client/js'

// Helper function to get all product accounts
export function getProductProgramAccounts(rpc: SolanaClient['rpc'], addresses: Address[]) {
  return fetchAllProduct(rpc, addresses)
}
