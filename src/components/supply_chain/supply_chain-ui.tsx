import { ellipsify, useWalletUi } from '@wallet-ui/react'
import {
  useProductAccountsQuery,
  useInitializeProductMutation,
  useLogEventMutation,
  useTransferOwnershipMutation,
  useSupplyChainProgram,
  useSupplyChainProgramId,
  useCreateProductForm,
  useLogEventForm,
  useProductEventsQuery,
  useProductQuery,
  EventType,
  ProductStatus,
} from './supply_chain-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ReactNode, useState, useEffect, useCallback, useRef } from 'react'
import type { Account, Address } from 'gill'
import QRCode from 'qrcode'
import QrScanner from 'qr-scanner'
import Image from 'next/image'

const QR_CODE_CONFIG = {
  width: 300,
  margin: 4,
  errorCorrectionLevel: 'H' as const,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
}



const INPUT_LIMITS = {
  SERIAL_NUMBER_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 200
}


type ProductData = {
  owner: Address
  serialNumber: string
  description: string
  status: ProductStatus
  createdAt: bigint
  eventsCounter: bigint
}

type ProductAccount = Account<ProductData>

export function SupplyChainProgramExplorerLink() {
  const programId = useSupplyChainProgramId()
  return <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
}

export function ProductList() {
  const productsQuery = useProductAccountsQuery()

  if (productsQuery.isLoading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  }

  if (!productsQuery.data?.length) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-semibold mb-2">No Products Found</h2>
        <p className="text-gray-600">Create your first product to get started with supply chain tracking.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {productsQuery.data?.map((product) => (
        <ProductCard key={product.address} product={product} />
      ))}
    </div>
  )
}

export function SupplyChainProgramGuard({ children }: { children: ReactNode }) {
  const programAccountQuery = useSupplyChainProgram()

  if (programAccountQuery.isLoading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  }

  if (!programAccountQuery.data?.value) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-800">
          Program account not found. Make sure you have deployed the program and are on the correct cluster.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

function ProductCard({ product }: { product: ProductAccount }) {
  const [showEventForm, setShowEventForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  
  const productQuery = useProductQuery(product.address as Address)
  const currentProduct = productQuery.data || product

  const getStatusColor = (status: ProductStatus) => {
    switch (status) {
      case ProductStatus.Created: return 'bg-blue-100 text-blue-800'
      case ProductStatus.InTransit: return 'bg-yellow-100 text-yellow-800'
      case ProductStatus.Received: return 'bg-green-100 text-green-800'
      case ProductStatus.Delivered: return 'bg-green-100 text-green-800'
      case ProductStatus.Transferred: return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Product #{currentProduct.data.serialNumber}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentProduct.data.status)}`}>
            {ProductStatus[currentProduct.data.status]}
          </span>
        </CardTitle>
        <CardDescription>
          <div className="space-y-1">
            <div>{currentProduct.data.description}</div>
            <div className="text-xs">
              Owner: <ExplorerLink address={currentProduct.data.owner} label={ellipsify(currentProduct.data.owner)} />
            </div>
            <div className="text-xs">
              Account: <ExplorerLink address={currentProduct.address} label={ellipsify(currentProduct.address)} />
            </div>
            <div className="text-xs">
              Events: {currentProduct.data.eventsCounter.toString()}
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Button 
            onClick={() => setShowQRCode(!showQRCode)} 
            variant="outline" 
            className="w-full"
          >
            {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
          </Button>
          {showQRCode && (
            <ProductQRCode productAddress={product.address as Address} />
          )}
          <Button 
            onClick={() => setShowEvents(!showEvents)} 
            variant="outline" 
            className="w-full"
          >
            {showEvents ? 'Hide Events' : 'View Events'}
          </Button>
          {showEvents && (
            <EventsList productAddress={product.address as Address} />
          )}
          <Button 
            onClick={() => setShowEventForm(!showEventForm)} 
            variant="outline" 
            className="w-full"
          >
            {showEventForm ? 'Cancel' : 'Log Event'}
          </Button>
          {showEventForm && (
            <LogEventForm 
              productAddress={product.address as Address} 
              onClose={() => setShowEventForm(false)} 
            />
          )}
          <Button 
            onClick={() => setShowTransferForm(!showTransferForm)} 
            variant="outline" 
            className="w-full"
          >
            {showTransferForm ? 'Cancel' : 'Transfer Ownership'}
          </Button>
          {showTransferForm && (
            <TransferOwnershipForm 
              productAddress={product.address as Address} 
              onClose={() => setShowTransferForm(false)} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function CreateProductForm() {
  const { serialNumber, setSerialNumber, description, setDescription, reset, isValid } = useCreateProductForm()
  const createProductMutation = useInitializeProductMutation()
  const [lastError, setLastError] = useState<Error | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    
    try {
      setLastError(null)
      await createProductMutation.mutateAsync({ serialNumber, description })
      reset()
    } catch (error) {
      setLastError(error instanceof Error ? error : new Error(String(error)))
      console.error('Error creating product:', error)
      
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        })
      }
      
      console.error('Browser info:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Product</CardTitle>
        <CardDescription>
          Register a new product in the supply chain tracking system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter unique product serial number"
              required
              maxLength={INPUT_LIMITS.SERIAL_NUMBER_MAX_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter product description"
              required
              maxLength={INPUT_LIMITS.DESCRIPTION_MAX_LENGTH}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!isValid || createProductMutation.isPending}
            className="w-full"
          >
            {createProductMutation.isPending ? 'Creating Product...' : 'Create Product'}
          </Button>
          {lastError && process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
              <details>
                <summary className="cursor-pointer font-medium text-red-800">
                  Debug Information (Development Only)
                </summary>
                <pre className="mt-2 text-red-700 overflow-auto">
                  {JSON.stringify(lastError, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function LogEventForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  const logEventMutation = useLogEventMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    try {
      await logEventMutation.mutateAsync({ productAddress, eventType, description })
      reset()
      onClose()
    } catch (error) {
      console.error('Error logging event:', error)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Log Event</h3>
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
        >
          ✕
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="eventType">Event Type</Label>
          <select
            id="eventType"
            value={eventType}
            onChange={(e) => setEventType(parseInt(e.target.value) as EventType)}
            className="w-full p-2 border rounded-lg bg-white"
          >
            <option value={EventType.Created}>Created</option>
            <option value={EventType.Shipped}>Shipped</option>
            <option value={EventType.Received}>Received</option>
            <option value={EventType.QualityCheck}>Quality Check</option>
            <option value={EventType.Delivered}>Delivered</option>
            <option value={EventType.Other}>Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="eventDescription">Description</Label>
          <Input
            id="eventDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter event description"
            required
            maxLength={INPUT_LIMITS.DESCRIPTION_MAX_LENGTH}
          />
        </div>
        <Button 
          type="submit" 
          disabled={!isValid || logEventMutation.isPending}
          className="w-full"
        >
          {logEventMutation.isPending ? 'Logging Event...' : 'Log Event'}
        </Button>
      </form>
    </div>
  )
}

function TransferOwnershipForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  const [newOwner, setNewOwner] = useState('')
  const transferMutation = useTransferOwnershipMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOwner.trim()) return

    try {
      await transferMutation.mutateAsync({ 
        productAddress, 
        newOwner: newOwner.trim() as Address 
      })
      onClose()
    } catch (error) {
      console.error('Error transferring ownership:', error)
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transfer Ownership</h3>
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
        >
          ✕
        </Button>
      </div>
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800 text-sm">
          <strong>Warning:</strong> Ownership transfer is irreversible. Make sure the new owner address is correct.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newOwner">New Owner Address</Label>
          <Input
            id="newOwner"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="Enter Solana address of new owner"
            required
          />
        </div>
        <Button 
          type="submit" 
          disabled={!newOwner.trim() || transferMutation.isPending}
          className="w-full"
        >
          {transferMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}
        </Button>
      </form>
    </div>
  )
}

function EventsList({ productAddress }: { productAddress: Address }) {
  const eventsQuery = useProductEventsQuery(productAddress)

  const getEventTypeColor = (eventType: EventType) => {
    switch (eventType) {
      case EventType.Created: return 'bg-blue-100 text-blue-800'
      case EventType.Shipped: return 'bg-yellow-100 text-yellow-800'
      case EventType.Received: return 'bg-green-100 text-green-800'
      case EventType.QualityCheck: return 'bg-purple-100 text-purple-800'
      case EventType.Delivered: return 'bg-green-100 text-green-800'
      case EventType.Other: return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (eventsQuery.isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!eventsQuery.data?.length) {
    return (
      <div className="text-center p-4 text-gray-500">
        No events logged yet. Log the first event to start tracking this product.
      </div>
    )
  }

  return (
    <div className="max-h-64 overflow-y-auto border rounded-lg">
      <div className="space-y-2 p-3">
        {eventsQuery.data.map((event, index) => (
          <div key={index} className="border-b last:border-b-0 pb-2 last:pb-0">
            <div className="flex items-center justify-between mb-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.data.eventType)}`}>
                {EventType[event.data.eventType]}
              </span>
              <span className="text-xs text-gray-500">
                Event #{event.data.eventIndex.toString()}
              </span>
            </div>
            <p className="text-sm mb-1">{event.data.description}</p>
            <p className="text-xs text-gray-500">
              {new Date(Number(event.data.timestamp) * 1000).toUTCString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductQRCode({ productAddress }: { productAddress: Address }) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const generateQRCode = async () => {
      setIsGenerating(true)
      try {
        const qrData = `${window.location.origin}/supply_chain?scan=${encodeURIComponent(productAddress)}`
        const dataURL = await QRCode.toDataURL(qrData, QR_CODE_CONFIG)
        setQrCodeDataURL(dataURL)
        setError('')
      } catch (err) {
        console.error('Error generating QR code:', err)
        setError('Failed to generate QR code')
      } finally {
        setIsGenerating(false)
      }
    }

    generateQRCode()
  }, [productAddress])

  const handleDownload = () => {
    if (!qrCodeDataURL) return

    const link = document.createElement('a')
    link.href = qrCodeDataURL
    link.download = `product-${productAddress}-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isGenerating) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-3 p-4 bg-gray-50 rounded-lg">
      {qrCodeDataURL && (
        <Image 
          src={qrCodeDataURL} 
          alt={`QR Code for product ${productAddress}`}
          className="w-48 h-48 border border-gray-200 rounded"
          width={192}
          height={192}
        />
      )}
      
      <p className="text-xs text-gray-600 text-center font-mono break-all">
        Product: {productAddress}
      </p>
      <Button 
        onClick={handleDownload}
        variant="outline"
        size="sm"
        disabled={!qrCodeDataURL}
      >
        Download QR Code
      </Button>
    </div>
  )
}

export function QRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedProductAddress, setScannedProductAddress] = useState<Address | null>(null)
  const [error, setError] = useState('')
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [isPhantomMobile, setIsPhantomMobile] = useState(false)
  const [isInAppBrowser, setIsInAppBrowser] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const stopScanning = useCallback(() => {
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current);
    }
    scanningTimeoutRef.current = setTimeout(() => {
      setIsScanning(false);
      scanningTimeoutRef.current = null;
    }, 1000); // Increased delay to 1000ms
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || ''
      return /android|webos|iphone|ipad|ipod|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    
    const checkPhantomMobile = () => {
      const userAgent = navigator.userAgent || ''
      return userAgent.toLowerCase().includes('phantom')
    }
    
    const checkInAppBrowser = () => {
      const userAgent = navigator.userAgent || ''
      // Common in-app browser patterns
      return /wv|webview|inappbrowser|phantom|metamask|trustwallet|coinbase/i.test(userAgent.toLowerCase())
    }
    
    setIsMobileDevice(checkMobile())
    setIsPhantomMobile(checkPhantomMobile())
    setIsInAppBrowser(checkInAppBrowser())
  }, [])

  useEffect(() => {
    let qrScanner: QrScanner | null = null;

    if (isScanning) {
      const videoEl = videoRef.current;
      if (videoEl) {
        const throttledScanResult = (result: string | { data: string }) => {
          const resultData = typeof result === 'string' ? result : result.data;
          console.log('Scan successful:', resultData);
          try {
            const url = new URL(resultData);
            const productAddress = url.searchParams.get('scan');
            if (productAddress) {
              const decodedAddress = decodeURIComponent(productAddress);
              setScannedProductAddress(decodedAddress as Address);
              stopScanning();
            } else {
              setError('Invalid QR code. Please scan a product QR code.');
            }
          } catch {
            if (resultData.length >= 32 && resultData.length <= 44) {
              setScannedProductAddress(resultData as Address);
              stopScanning();
            } else {
              setError('Invalid QR code format.');
            }
          }
        };

        qrScanner = new QrScanner(
        videoEl,
        throttledScanResult,
        {
          onDecodeError: (error) => {
            console.error('QR Scanner decoding error:', error);
            setError('Failed to decode QR code. Please try again.');
          },
          returnDetailedScanResult: true,
          highlightScanRegion: !isMobileDevice,
          highlightCodeOutline: !isMobileDevice,
          maxScansPerSecond: isMobileDevice ? 2 : 10,
          preferredCamera: 'environment'
        }
      );

        qrScanner.start().catch((err) => {
          console.error('Camera error:', err);
          setError(`Camera error: ${err.message}`);
          stopScanning();
        });
      }
    }

    return () => {
      qrScanner?.destroy();
    };
  }, [isScanning, stopScanning, isMobileDevice]);

  if (scannedProductAddress) {
    return (
      <QRScanEventForm
        productAddress={scannedProductAddress}
        onClose={() => setScannedProductAddress(null)}
      />
    )
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4 text-center">QR Code Scanner</h3>

      {!isScanning ? (
        <div className="text-center space-y-4">
          <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-600 mb-4">Scan a product QR code to log events</p>
            {isMobileDevice && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                {isPhantomMobile || isInAppBrowser ? (
                  <div className="text-blue-800 text-sm">
                    <p className="font-semibold mb-2">🔷 Phantom Browser Tips:</p>
                    <ul className="text-xs space-y-1">
                      <li>• When prompted, tap <strong>&quot;Allow&quot;</strong> for camera access</li>
                      <li>• If camera fails, use the manual input option below</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-blue-800 text-sm">
                    <strong>Mobile Tips:</strong> Ensure camera permissions are enabled and hold your device steady when scanning.
                  </p>
                )}
              </div>
            )}
            <Button onClick={() => {
              setError('');
              setIsScanning(true);
            }}>
              Start Scanning
            </Button>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          {/* Manual input option for when camera fails */}
          {(isMobileDevice || error) && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Manual Input</h3>
              <p className="text-xs text-gray-600 mb-3">
                Enter the product address manually:
              </p>
              <div className="flex flex-col space-y-2">
                <input
                  type="text"
                  placeholder="Enter product address (32-44 characters)"
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                />
                <Button
                  onClick={() => {
                    if (manualAddress.length >= 32 && manualAddress.length <= 44) {
                      setScannedProductAddress(manualAddress as Address)
                      setManualAddress('')
                    } else {
                      setError('Please enter a valid product address (32-44 characters)')
                    }
                  }}
                  disabled={!manualAddress.trim()}
                  className="text-sm"
                >
                  Use Manual Address
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-64 bg-black rounded-lg object-cover"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white rounded-lg p-4 bg-black bg-opacity-30">
                <p className="text-white text-sm text-center">
                  Point camera at QR code
                </p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Button 
              onClick={stopScanning}
              variant="outline"
            >
              Stop Scanning
            </Button>
          </div>
          {isMobileDevice && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              {isPhantomMobile || isInAppBrowser ? (
                <div className="text-blue-800 text-sm text-center">
                  <p className="font-semibold mb-1">🔷 Phantom Scanning</p>
                  <p className="text-xs">
                    Hold steady • Ensure good lighting • QR code should fill the viewfinder
                  </p>
                </div>
              ) : (
                <p className="text-blue-800 text-sm text-center">
                  <strong>Tip:</strong> Hold your device steady and ensure the QR code is well-lit for best results.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QRScanEventForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  const logEventMutation = useLogEventMutation()
  const productQuery = useProductQuery(productAddress)
  const { account } = useWalletUi()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    if (!account) {
      console.error('Wallet not connected')
      alert('Please connect your wallet first')
      return
    }

    if (productQuery.data && productQuery.data.data.owner !== account.address) {
      alert(`Only the product owner can log events. Owner: ${productQuery.data.data.owner}, Current wallet: ${account.address}`)
      return
    }

    try {
      await logEventMutation.mutateAsync({ productAddress, eventType, description })
      reset()
      onClose()
    } catch (error) {
      console.error('Error logging event:', error)
      
      if (error instanceof Error && error.message.includes('UnauthorizedAccess')) {
        alert('You are not authorized to log events for this product. Only the product owner can log events.')
      } else if (error instanceof Error && error.message.includes('Unexpected error')) {
        alert('Transaction failed. Please check your wallet connection and try again.')
      } else if (error instanceof Error) {
        alert(`Transaction failed: ${error.message}`)
      }
    }
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Log Event</h3>
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
        >
          ✕
        </Button>
      </div>

      {productQuery.data && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm">
            <div className="font-medium">Product #{productQuery.data.data.serialNumber}</div>
            <div className="text-gray-600">{productQuery.data.data.description}</div>
            <div className="text-xs text-gray-500 mt-1">
              Status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                productQuery.data.data.status === ProductStatus.Created ? 'bg-blue-100 text-blue-800' :
                productQuery.data.data.status === ProductStatus.InTransit ? 'bg-yellow-100 text-yellow-800' :
                productQuery.data.data.status === ProductStatus.Received ? 'bg-green-100 text-green-800' :
                productQuery.data.data.status === ProductStatus.Delivered ? 'bg-green-100 text-green-800' :
                productQuery.data.data.status === ProductStatus.Transferred ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {ProductStatus[productQuery.data.data.status]}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Owner: <span className="font-mono">{ellipsify(productQuery.data.data.owner)}</span>
              {account && productQuery.data.data.owner === account.address && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  You own this product
                </span>
              )}
              {account && productQuery.data.data.owner !== account.address && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  Not authorized
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mobileEventType">Event Type</Label>
          <select
            id="mobileEventType"
            value={eventType}
            onChange={(e) => setEventType(parseInt(e.target.value) as EventType)}
            className="w-full p-3 border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={EventType.Created}>Created</option>
            <option value={EventType.Shipped}>Shipped</option>
            <option value={EventType.Received}>Received</option>
            <option value={EventType.QualityCheck}>Quality Check</option>
            <option value={EventType.Delivered}>Delivered</option>
            <option value={EventType.Other}>Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobileEventDescription">Description</Label>
          <Input
            id="mobileEventDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter event description"
            required
            maxLength={INPUT_LIMITS.DESCRIPTION_MAX_LENGTH}
            className="p-3 text-base"
          />
        </div>
        <Button 
          type="submit" 
          disabled={!isValid || logEventMutation.isPending}
          className="w-full p-3 text-base"
        >
          {logEventMutation.isPending ? 'Logging Event...' : 'Log Event'}
        </Button>
      </form>
    </div>
  )
}