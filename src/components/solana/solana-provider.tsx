import dynamic from 'next/dynamic'
import { ReactNode } from 'react'
import { createSolanaDevnet, createSolanaLocalnet, createWalletUiConfig, WalletUi } from '@wallet-ui/react'

export const WalletButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiDropdown, {
  ssr: false,
})
export const ClusterButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiClusterDropdown, {
  ssr: false,
})

const solanaDevnet = createSolanaDevnet()
const solanaLocalnet = createSolanaLocalnet()

const config = createWalletUiConfig({
  clusters: [
    solanaDevnet || { id: 'solana-devnet', name: 'Solana Devnet', endpoint: '' },
    solanaLocalnet || { id: 'solana-localnet', name: 'Solana Localnet', endpoint: '' },
  ].filter(Boolean),
})

export function SolanaProvider({ children }: { children: ReactNode }) {
  if (!config) {
    return null // Or a loading spinner
  }
  return <WalletUi config={config}>{children}</WalletUi>
}
