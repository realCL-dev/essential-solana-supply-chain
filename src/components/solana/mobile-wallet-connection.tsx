'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import QRCode from 'qrcode'
import Image from 'next/image'

// PWA BeforeInstallPrompt event type
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

interface MobileWalletConnectionProps {
  onWalletSelected?: (walletName: string) => void
}

export function MobileWalletConnection({ onWalletSelected }: MobileWalletConnectionProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [showQR, setShowQR] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || (navigator as unknown as { vendor?: string }).vendor || (window as unknown as { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(String(userAgent).toLowerCase())
    }
    setIsMobile(checkMobile())
  }, [])

  useEffect(() => {
    if (showQR) {
      generateQRCode()
    }
  }, [showQR])

  const generateQRCode = async () => {
    try {
      const connectUrl = `${window.location.origin}/connect`
      const qrDataURL = await QRCode.toDataURL(connectUrl, {
        width: 300,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeUrl(qrDataURL)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const walletApps = [
    {
      name: 'Phantom',
      icon: '👻',
      deepLink: 'https://phantom.app/ul/browse/' + encodeURIComponent(window.location.href),
      storeLink: {
        ios: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
        android: 'https://play.google.com/store/apps/details?id=app.phantom'
      }
    },
    {
      name: 'Solflare',
      icon: '🔥',
      deepLink: 'https://solflare.com/ul/browse/' + encodeURIComponent(window.location.href),
      storeLink: {
        ios: 'https://apps.apple.com/app/solflare/id1580902717',
        android: 'https://play.google.com/store/apps/details?id=com.solflare.mobile'
      }
    }
  ]

  const handleWalletClick = (wallet: typeof walletApps[0]) => {
    if (isMobile) {
      // Try deep link first
      window.location.href = wallet.deepLink
      
      // Fallback to app store after a delay
      setTimeout(() => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const storeUrl = isIOS ? wallet.storeLink.ios : wallet.storeLink.android
        window.open(storeUrl, '_blank')
      }, 2000)
    } else {
      // Desktop: show QR code
      setShowQR(true)
    }
    
    onWalletSelected?.(wallet.name)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📱 Connect Mobile Wallet
        </CardTitle>
        <CardDescription>
          {isMobile 
            ? 'Tap a wallet to connect directly from your mobile device'
            : 'Scan QR code with your mobile wallet app'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!showQR ? (
          <div className="space-y-3">
            {walletApps.map((wallet) => (
              <Button
                key={wallet.name}
                onClick={() => handleWalletClick(wallet)}
                variant="outline"
                className="w-full h-16 flex items-center gap-3 text-left"
              >
                <span className="text-2xl">{wallet.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{wallet.name}</div>
                  <div className="text-xs text-gray-500">
                    {isMobile ? 'Tap to open app' : 'Click for QR code'}
                  </div>
                </div>
              </Button>
            ))}
            
            {!isMobile && (
              <div className="text-center pt-4">
                <Button
                  onClick={() => setShowQR(true)}
                  variant="ghost"
                  className="text-sm"
                >
                  Show QR Code for All Wallets
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-white p-4 rounded-lg border">
              {qrCodeUrl && (
                <Image 
                  src={qrCodeUrl} 
                  alt="Wallet Connection QR Code" 
                  width={250}
                  height={250}
                  className="mx-auto"
                />
              )}
            </div>
            <div className="text-sm text-gray-600">
              Scan with any Solana mobile wallet app
            </div>
            <Button
              onClick={() => setShowQR(false)}
              variant="outline"
              size="sm"
            >
              Back to Wallet List
            </Button>
          </div>
        )}

        {isMobile && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              💡 <strong>Don&apos;t have a wallet?</strong>
              <br />Download from your app store and return here to connect.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Progressive Web App installation prompt
export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false)
    }
    
    setDeferredPrompt(null)
  }

  if (!showInstallPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start gap-3">
        <div className="text-2xl">📱</div>
        <div className="flex-1">
          <div className="font-medium text-sm">Install Supply Chain App</div>
          <div className="text-xs text-gray-600 mt-1">
            Add to home screen for better mobile experience
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleInstall} size="sm">
              Install
            </Button>
            <Button 
              onClick={() => setShowInstallPrompt(false)} 
              variant="ghost" 
              size="sm"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}