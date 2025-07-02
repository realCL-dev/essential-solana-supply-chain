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
import { ReactNode, useState, useEffect } from 'react'
import type { Account, Address } from 'gill'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    try {
      await initializeMutation.mutateAsync({ serialNumber, description })
      reset()
    } catch (error) {
      console.error('Error creating product:', error)
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