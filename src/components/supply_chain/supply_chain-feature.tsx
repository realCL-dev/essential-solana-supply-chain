import { WalletButton } from '../solana/solana-provider'
import { 
  CreateProductForm, 
  ProductList, 
  SupplyChainProgramExplorerLink, 
  SupplyChainProgramGuard 
} from './supply_chain-ui'
import { AppHero } from '../app-hero'
import { useWalletUi } from '@wallet-ui/react'

export default function SupplyChainFeature() {
  const { account } = useWalletUi()

  return (
    <SupplyChainProgramGuard>
      <AppHero
        title="Supply Chain Tracker"
        subtitle={
          account
            ? "Create products, log events, and track ownership through the supply chain. Each product is represented as an on-chain account with immutable event history."
            : 'Connect your wallet to start tracking products in the supply chain.'
        }
      >
        <p className="mb-6">
          <SupplyChainProgramExplorerLink />
        </p>
        {!account && (
          <div style={{ display: 'inline-block' }}>
            <WalletButton />
          </div>
        )}
      </AppHero>

      {account && (
        <div className="space-y-8">
          {/* Create Product Section */}
          <div className="max-w-2xl mx-auto">
            <CreateProductForm />
          </div>

          {/* Products List Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center">
              Supply Chain Products
            </h2>
            <ProductList />
          </div>
        </div>
      )}
    </SupplyChainProgramGuard>
  )
}