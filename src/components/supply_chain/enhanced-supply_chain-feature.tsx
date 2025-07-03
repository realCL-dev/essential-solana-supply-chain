'use client'

import { useState, useEffect } from 'react'
import { WalletButton } from '../solana/solana-provider'
import { MobileWalletStatus } from '../solana/mobile-wallet-ui'
import { WalletSystemSelector } from '../solana/enhanced-solana-provider'
import { 
  CreateProductForm, 
  ProductList, 
  SupplyChainProgramExplorerLink, 
  SupplyChainProgramGuard,
  QRScanner
} from './supply_chain-ui'
import { AppHero } from '../app-hero'
import { useWalletUi } from '@wallet-ui/react'
import { useWallet } from '@solana/wallet-adapter-react'

import { useIsMobile } from '../solana/use-is-mobile'

export default function EnhancedSupplyChainFeature() {
  const isMobile = useIsMobile()
  const [useMobileWallet, setUseMobileWallet] = useState(false)
  const [showWalletSelector, setShowWalletSelector] = useState(false)

  const walletUi = useWalletUi()
  const gillAccount = walletUi ? walletUi.account : null
  const { connected: walletAdapterConnected, publicKey: walletAdapterKey } = useWallet() || { connected: false, publicKey: null }

  useEffect(() => {
    const checkWalletSystem = () => {
      const preference = localStorage.getItem('wallet-preference')
      setUseMobileWallet(isMobile || preference === 'mobile')
    }
    
    checkWalletSystem()
  }, [isMobile])

  // Determine if wallet is connected based on the current system
  const isWalletConnected = useMobileWallet ? walletAdapterConnected : !!gillAccount
  const walletAddress = useMobileWallet ? walletAdapterKey?.toString() : gillAccount?.address

  return (
    <SupplyChainProgramGuard>
      <AppHero
        title="Supply Chain Tracker"
        subtitle={
          isWalletConnected
            ? "Create products, log events, and track ownership through the supply chain. Each product is represented as an on-chain account with immutable event history."
            : 'Connect your wallet to start tracking products in the supply chain.'
        }
      >
        <div className="space-y-4">
          <p className="mb-6">
            <SupplyChainProgramExplorerLink />
          </p>
          
          {/* Wallet System Selector */}
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setShowWalletSelector(!showWalletSelector)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showWalletSelector ? 'Hide' : 'Show'} Wallet Options
            </button>
            {showWalletSelector && (
              <div className="mt-4">
                <WalletSystemSelector />
              </div>
            )}
          </div>

          {/* Wallet Connection UI */}
          {!isWalletConnected && (
            <div className="max-w-md mx-auto">
              {useMobileWallet ? (
                <MobileWalletStatus />
              ) : (
                <div style={{ display: 'inline-block' }}>
                  <WalletButton />
                </div>
              )}
            </div>
          )}

          {/* Connected Wallet Info */}
          {isWalletConnected && walletAddress && (
            <div className="max-w-md mx-auto p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                ✅ Wallet Connected ({useMobileWallet ? 'Mobile' : 'Desktop'})
                <br />
                <span className="font-mono text-xs">
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                </span>
              </div>
            </div>
          )}
        </div>
      </AppHero>

      {isWalletConnected && (
        <div className="space-y-8">
          {/* QR Scanner Section */}
          <div className="max-w-md mx-auto">
            <QRScanner />
          </div>

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