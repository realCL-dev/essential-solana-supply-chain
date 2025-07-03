'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useState, useEffect } from 'react'

// Mobile-optimized wallet button
export function MobileWalletButton() {
  const { wallet, connected, connecting, publicKey } = useWallet()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    setIsMobile(checkMobile())
  }, [])

  if (connected && publicKey) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-green-600 font-medium">
          ✅ {wallet?.adapter.name} Connected
        </div>
        <div className="text-xs text-gray-600">
          {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
        </div>
        <WalletDisconnectButton className="!bg-red-500 !text-white !rounded-lg !px-4 !py-2 !text-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <WalletMultiButton className="!bg-blue-600 !text-white !rounded-lg !px-6 !py-3 !text-base !font-medium !w-full" />
      {isMobile && (
        <div className="text-xs text-gray-500 text-center">
          Tap to connect your mobile wallet app
        </div>
      )}
      {connecting && (
        <div className="text-sm text-blue-600 text-center">
          Connecting to wallet...
        </div>
      )}
    </div>
  )
}

// Mobile wallet status card
export function MobileWalletStatus() {
  const { wallet, connected, publicKey, connecting } = useWallet()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    setIsMobile(checkMobile())
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📱 {isMobile ? 'Mobile' : 'Desktop'} Wallet Status
        </CardTitle>
        <CardDescription>
          Connect your Solana wallet to interact with the supply chain
        </CardDescription>
      </CardHeader>
      <CardContent>
        {connecting ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Connecting to wallet...</div>
          </div>
        ) : connected && publicKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium">{wallet?.adapter.name}</span>
            </div>
            <div className="text-sm text-gray-600">
              <div>Address: {publicKey.toString()}</div>
            </div>
            {isMobile && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-800">
                  ✅ Mobile wallet connected successfully!
                  <br />You can now create products and log events.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-gray-600">No wallet connected</span>
            </div>
            {isMobile && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  📱 Install a mobile wallet app:
                  <br />• Phantom Mobile
                  <br />• Solflare Mobile
                  <br />• Glow Wallet
                </div>
              </div>
            )}
            <MobileWalletButton />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Deep link helper for mobile wallets
export function useMobileWalletDeepLink() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    setIsMobile(checkMobile())
  }, [])

  const openWalletApp = (walletName: string) => {
    if (!isMobile) return

    const deepLinks = {
      phantom: 'https://phantom.app/ul/browse/' + encodeURIComponent(window.location.href),
      solflare: 'https://solflare.com/ul/browse/' + encodeURIComponent(window.location.href),
      glow: 'https://glow.app/ul/browse/' + encodeURIComponent(window.location.href),
    }

    const link = deepLinks[walletName.toLowerCase() as keyof typeof deepLinks]
    if (link) {
      window.open(link, '_blank')
    }
  }

  return {
    isMobile,
    openWalletApp,
  }
}