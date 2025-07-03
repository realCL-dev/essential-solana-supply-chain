import { ellipsify } from '@wallet-ui/react'
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

// Type for Product account data structure
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
  
  // Query for the latest product data to ensure real-time updates
  const productQuery = useProductQuery(product.address as Address)
  
  // Use the fresh data if available, otherwise fallback to the passed product
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
              onSuccess={() => setShowEventForm(false)} 
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
              onSuccess={() => setShowTransferForm(false)} 
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function CreateProductForm() {
  const { serialNumber, setSerialNumber, description, setDescription, reset, isValid } = useCreateProductForm()
  const initializeMutation = useInitializeProductMutation()
  const [lastError, setLastError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLastError('')
    try {
      await initializeMutation.mutateAsync({ serialNumber, description })
      reset()
    } catch (error) {
      console.error('Error creating product:', error)
      
      // Enhanced error debugging for mobile
      let errorMsg = 'Unknown error occurred'
      
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'string') {
        errorMsg = error
      } else if (error && typeof error === 'object') {
        // Try to extract useful info from object errors
        const errorObj = error as Record<string, unknown>
        if (errorObj.message && typeof errorObj.message === 'string') {
          errorMsg = errorObj.message
        } else if (errorObj.error && typeof errorObj.error === 'string') {
          errorMsg = errorObj.error
        } else if (errorObj.code && (typeof errorObj.code === 'string' || typeof errorObj.code === 'number')) {
          errorMsg = `Error code: ${errorObj.code}`
        } else {
          errorMsg = `Object error: ${JSON.stringify(error)}`
        }
      }
      
      setLastError(`Debug info: ${errorMsg} | Type: ${typeof error} | Browser: ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Product</CardTitle>
        <CardDescription>
          Initialize a new product in the supply chain system
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
              placeholder="Enter unique serial number"
              required
              maxLength={50}
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
              maxLength={200}
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={!isValid || initializeMutation.isPending}
            className="w-full"
          >
            {initializeMutation.isPending ? 'Creating...' : 'Create Product'}
          </Button>
          
          {lastError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm font-medium">Error Details:</p>
              <p className="text-red-600 text-xs mt-1 break-words">{lastError}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function LogEventForm({ productAddress, onSuccess }: { productAddress: Address; onSuccess: () => void }) {
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  const logEventMutation = useLogEventMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    try {
      await logEventMutation.mutateAsync({ productAddress, eventType, description })
      reset()
      onSuccess()
    } catch (error) {
      console.error('Error logging event:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded">
      <div className="space-y-2">
        <Label htmlFor="eventType">Event Type</Label>
        <select
          id="eventType"
          value={eventType}
          onChange={(e) => setEventType(parseInt(e.target.value) as EventType)}
          className="w-full p-2 border rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          maxLength={200}
          className="text-gray-900 bg-white"
        />
      </div>
      
      <Button 
        type="submit" 
        disabled={!isValid || logEventMutation.isPending}
        size="sm"
        className="w-full"
      >
        {logEventMutation.isPending ? 'Logging...' : 'Log Event'}
      </Button>
    </form>
  )
}

function TransferOwnershipForm({ productAddress, onSuccess }: { productAddress: Address; onSuccess: () => void }) {
  const [newOwner, setNewOwner] = useState('')
  const transferMutation = useTransferOwnershipMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOwner.trim()) return

    try {
      await transferMutation.mutateAsync({ 
        productAddress, 
        newOwner: newOwner as Address 
      })
      setNewOwner('')
      onSuccess()
    } catch (error) {
      console.error('Error transferring ownership:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded">
      <div className="space-y-2">
        <Label htmlFor="newOwner">New Owner Address</Label>
        <Input
          id="newOwner"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          placeholder="Enter new owner's public key"
          required
        />
      </div>
      
      <Button 
        type="submit" 
        disabled={!newOwner.trim() || transferMutation.isPending}
        size="sm"
        className="w-full"
      >
        {transferMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}
      </Button>
    </form>
  )
}

function EventsList({ productAddress }: { productAddress: Address }) {
  const eventsQuery = useProductEventsQuery(productAddress)

  if (eventsQuery.isLoading) {
    return (
      <div className="p-3 border rounded">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  if (!eventsQuery.data?.length) {
    return (
      <div className="p-3 border rounded text-center text-sm text-gray-500">
        No events found for this product
      </div>
    )
  }

  const getEventTypeColor = (eventType: EventType) => {
    switch (eventType) {
      case EventType.Created: return 'bg-blue-100 text-blue-800'
      case EventType.Shipped: return 'bg-yellow-100 text-yellow-800'
      case EventType.Received: return 'bg-green-100 text-green-800'
      case EventType.Delivered: return 'bg-green-100 text-green-800'
      case EventType.QualityCheck: return 'bg-purple-100 text-purple-800'
      case EventType.Other: return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-2 p-3 border rounded max-h-60 overflow-y-auto">
      <h4 className="font-medium text-sm">Event History</h4>
      {eventsQuery.data.map((event) => (
        <div key={event.address} className="p-2 bg-gray-50 rounded text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.data.eventType)}`}>
              {EventType[event.data.eventType]}
            </span>
            <span className="text-gray-500">
              #{event.data.eventIndex.toString()}
            </span>
          </div>
          <div className="text-gray-700">{event.data.description}</div>
          <div className="text-gray-500 mt-1">
            {new Date(Number(event.data.timestamp) * 1000).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProductQRCode({ productAddress }: { productAddress: Address }) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const generateQRCode = async () => {
      setIsGenerating(true)
      try {
        // Create a URL that includes the product address for scanning
        const qrData = `${window.location.origin}/supply_chain?scan=${productAddress}`
        const dataURL = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 4,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        setQrCodeDataURL(dataURL)
      } catch (error) {
        console.error('Error generating QR code:', error)
      } finally {
        setIsGenerating(false)
      }
    }

    generateQRCode()
  }, [productAddress])

  if (isGenerating) {
    return (
      <div className="p-4 border rounded text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Generating QR Code...</p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded text-center bg-white">
      <h4 className="font-medium text-sm mb-3">Product QR Code</h4>
      {qrCodeDataURL && (
        <div className="space-y-3">
          <Image 
            src={qrCodeDataURL} 
            alt="Product QR Code" 
            className="mx-auto border rounded"
            width={200}
            height={200}
          />
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              Scan to log events for this product
            </p>
            <p className="text-xs text-gray-500 font-mono break-all">
              {productAddress}
            </p>
          </div>
          <Button
            onClick={() => {
              const link = document.createElement('a')
              link.download = `product-${productAddress.slice(0, 8)}-qr.png`
              link.href = qrCodeDataURL
              link.click()
            }}
            size="sm"
            variant="outline"
            className="w-full"
          >
            Download QR Code
          </Button>
        </div>
      )}
    </div>
  )
}

export function QRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [scannedProductAddress, setScannedProductAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const scanningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const stopScanning = useCallback(() => {
    setIsScanning(false)
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current)
      scanningTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as Window & typeof globalThis & { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    setIsMobileDevice(checkMobile())
  }, [])

  useEffect(() => {
    if (!isScanning) {
      return
    }

    let qrScanner: QrScanner | null = null
    let lastScanTime = 0

    const videoEl = videoRef.current
    if (videoEl) {
      // Mobile-optimized video constraints
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          aspectRatio: 16/9
        }
      }

      // Apply mobile-specific constraints
      if (isMobileDevice) {
        navigator.mediaDevices.getUserMedia(constraints)
          .then(stream => {
            videoEl.srcObject = stream
          })
          .catch(err => {
            console.error('Mobile camera setup error:', err)
            setError('Failed to access camera. Please ensure camera permissions are granted.')
          })
      }

      // Throttled scanning function for mobile performance
      const throttledScanResult = (result: QrScanner.ScanResult) => {
        const currentTime = Date.now()
        if (currentTime - lastScanTime < 300) { // 300ms throttle
          return
        }
        lastScanTime = currentTime

        console.log('QR Code detected:', result)
        const resultData = result.data
        try {
          const url = new URL(resultData)
          const productAddress = url.searchParams.get('scan')
          if (productAddress) {
            setScannedProductAddress(productAddress as Address)
            stopScanning()
          } else {
            setError('Invalid QR code. Please scan a product QR code.')
          }
        } catch {
          if (resultData.length >= 32 && resultData.length <= 44) {
            setScannedProductAddress(resultData as Address)
            stopScanning()
          } else {
            setError('Invalid QR code format.')
          }
        }
      }

      qrScanner = new QrScanner(
        videoEl,
        throttledScanResult,
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: isMobileDevice ? 5 : 10, // Reduce for mobile performance
          preferredCamera: 'environment'
        }
      )

      qrScanner.start().catch((err) => {
        console.error('Camera error:', err)
        let errorMessage = 'Camera error: '
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            errorMessage += 'Camera permission denied. Please allow camera access and try again.'
          } else if (err.name === 'NotFoundError') {
            errorMessage += 'No camera found. Please ensure your device has a camera.'
          } else if (err.name === 'NotSupportedError') {
            errorMessage += 'Camera not supported. Please use HTTPS or try a different browser.'
          } else if (err.name === 'NotReadableError') {
            errorMessage += 'Camera is being used by another application.'
          } else {
            errorMessage += err.message
          }
        } else {
          errorMessage += 'Unknown error occurred. Please try again.'
        }
        setError(errorMessage)
        stopScanning()
      })
    }

    return () => {
      qrScanner?.destroy()
      if (scanningTimeoutRef.current) {
        clearTimeout(scanningTimeoutRef.current)
      }
    }
  }, [isScanning, stopScanning, isMobileDevice])

  if (scannedProductAddress) {
    return (
      <MobileScanEventForm
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
            <Button onClick={() => {
              setError('')
              setIsScanning(true)
            }} className="w-full">
              Start Camera
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <video
              ref={videoRef}
              className={`w-full rounded-lg object-cover ${isMobileDevice ? 'h-[400px]' : 'h-[300px]'} bg-black`}
              autoPlay
              muted
              playsInline
              style={{ 
                transform: isMobileDevice ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: 'center'
              }}
            />
            <div className="absolute top-0 left-0 w-full h-full" style={{ boxShadow: 'inset 0 0 0 5px rgba(255, 255, 255, 0.5)' }}></div>
            {isMobileDevice && (
              <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-xs p-2 rounded">
                Hold steady and ensure QR code is well-lit for better scanning
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button onClick={stopScanning} variant="outline" className="w-full">
            Stop Scanning
          </Button>
        </div>
      )}
    </div>
  )
}

function MobileScanEventForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  const logEventMutation = useLogEventMutation()
  const productQuery = useProductQuery(productAddress)

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
            maxLength={200}
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