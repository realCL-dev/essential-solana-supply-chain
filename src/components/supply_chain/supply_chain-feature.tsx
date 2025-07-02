import { WalletButton } from '../solana/solana-provider'
import { SupplyChainButtonInitialize, SupplyChainList, SupplyChainProgramExplorerLink, SupplyChainProgramGuard } from './supply_chain-ui'
import { AppHero } from '../app-hero'
import { useWalletUi } from '@wallet-ui/react'

export default function SupplyChainFeature() {
  const { account } = useWalletUi()

  return (
    <SupplyChainProgramGuard>
      <AppHero
        title="SupplyChain"
        subtitle={
          account
            ? "Initialize a new supply_chain onchain by clicking the button. Use the program's methods (increment, decrement, set, and close) to change the state of the account."
            : 'Select a wallet to run the program.'
        }
      >
        <p className="mb-6">
          <SupplyChainProgramExplorerLink />
        </p>
        {account ? (
          <SupplyChainButtonInitialize />
        ) : (
          <div style={{ display: 'inline-block' }}>
            <WalletButton />
          </div>
        )}
      </AppHero>
      {account ? <SupplyChainList /> : null}
    </SupplyChainProgramGuard>
  )
}
