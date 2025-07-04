/**
 * SUPPLY CHAIN UI COMPONENTS
 * 
 * This file contains all the user interface components for the Solana-based supply chain
 * tracking application. It provides a comprehensive set of React components that handle:
 * 
 * KEY FEATURES:
 * 
 * 1. PRODUCT MANAGEMENT:
 *    - Product creation forms with validation
 *    - Product listing with status indicators
 *    - Event logging for supply chain tracking
 *    - Ownership transfer capabilities
 * 
 * 2. QR CODE INTEGRATION:
 *    - QR code generation for products
 *    - Mobile-optimized QR code scanning
 *    - Camera integration with permission handling
 *    - URL-based and direct address scanning support
 * 
 * 3. MOBILE OPTIMIZATION:
 *    - Responsive design for mobile devices
 *    - Touch-friendly interfaces
 *    - Performance optimization for scanning
 *    - Mobile-specific camera constraints
 * 
 * 4. REAL-TIME DATA:
 *    - Live updates from blockchain state
 *    - React Query integration for caching
 *    - Loading and error state management
 *    - Automatic data refresh after operations
 * 
 * 5. USER EXPERIENCE:
 *    - Intuitive form designs
 *    - Clear status indicators
 *    - Comprehensive error handling
 *    - Accessibility considerations
 * 
 * COMPONENT ARCHITECTURE:
 * 
 * The components follow a hierarchical structure:
 * - Container components manage state and data fetching
 * - Presentation components handle UI rendering
 * - Form components manage user input and validation
 * - Utility components provide reusable functionality
 * 
 * MOBILE-FIRST DESIGN:
 * 
 * The interface is designed with mobile users in mind, particularly for:
 * - Warehouse workers scanning product QR codes
 * - Field personnel logging shipping/receiving events
 * - Quality control inspections and audits
 * - On-the-go supply chain management
 */

// Wallet UI integration for Solana wallet connections
import { ellipsify, useWalletUi } from '@wallet-ui/react'
// Data access hooks and types from the supply chain data layer
import {
  useProductAccountsQuery,        // Fetches all products from blockchain
  useInitializeProductMutation,   // Creates new products
  useLogEventMutation,           // Logs events to products
  useTransferOwnershipMutation,  // Transfers product ownership
  useSupplyChainProgram,         // Program account validation
  useSupplyChainProgramId,       // Program address retrieval
  useCreateProductForm,          // Form state for product creation
  useLogEventForm,              // Form state for event logging
  useProductEventsQuery,        // Fetches events for a specific product
  useProductQuery,              // Fetches single product data
  EventType,                    // Enum for event types
  ProductStatus,                // Enum for product statuses
} from './supply_chain-data-access'
// UI component library (shadcn/ui)
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Solana explorer link component
import { ExplorerLink } from '../cluster/cluster-ui'
// React hooks and utilities
import { ReactNode, useState, useEffect, useCallback, useRef } from 'react'
// Solana/Gill type definitions
import type { Account, Address } from 'gill'
// QR code generation library
import QRCode from 'qrcode'
// QR code scanning library with camera support
import QrScanner from 'qr-scanner'
// Next.js optimized image component
import Image from 'next/image'

/**
 * QR CODE GENERATION CONFIGURATION
 * 
 * Configuration object for generating QR codes using the qrcode library.
 * These settings balance size, readability, and error recovery.
 * 
 * - width: 300px provides good balance between size and scan distance
 * - margin: 4 units provides adequate quiet zone around QR code
 * - errorCorrectionLevel 'H': High error correction (30% damage recovery)
 * - colors: High contrast black/white for reliable scanning
 */
const QR_CODE_CONFIG = {
  width: 300,
  margin: 4,
  errorCorrectionLevel: 'H' as const,
  color: {
    dark: '#000000',    // Pure black for maximum contrast
    light: '#FFFFFF'    // Pure white background
  }
}

/**
 * QR CODE SCANNING PERFORMANCE CONSTANTS
 * 
 * These constants optimize QR code scanning performance across different devices:
 * 
 * SCAN_THROTTLE_MS: Minimum time between scan attempts to prevent excessive processing
 * MOBILE_MAX_SCANS_PER_SECOND: Reduced scan rate for mobile devices to preserve battery
 * DESKTOP_MAX_SCANS_PER_SECOND: Higher scan rate for desktop devices with more resources
 */
const SCAN_THROTTLE_MS = 300
const MOBILE_MAX_SCANS_PER_SECOND = 5
const DESKTOP_MAX_SCANS_PER_SECOND = 10

/**
 * INPUT VALIDATION LIMITS
 * 
 * Maximum character limits for form inputs to ensure data consistency
 * and prevent excessively long blockchain transactions.
 * 
 * These limits balance usability with blockchain storage efficiency.
 */
const INPUT_LIMITS = {
  SERIAL_NUMBER_MAX_LENGTH: 50,    // Reasonable limit for product serial numbers
  DESCRIPTION_MAX_LENGTH: 200      // Adequate space for product descriptions
}

/**
 * CAMERA CONFIGURATION FOR QR SCANNING
 * 
 * Video constraints optimized for QR code scanning across devices:
 * 
 * - facingMode 'environment': Uses back camera (better for scanning)
 * - width/height ranges: Accommodate different camera capabilities
 * - aspectRatio 16:9: Standard ratio for modern cameras
 * 
 * These constraints balance quality, performance, and compatibility.
 */
const VIDEO_CONSTRAINTS = {
  video: {
    facingMode: 'environment' as const,
    width: { min: 640, ideal: 1280, max: 1920 },
    height: { min: 480, ideal: 720, max: 1080 },
    aspectRatio: 16/9
  }
}

/**
 * PRODUCT DATA TYPE DEFINITION
 * 
 * Represents the structure of product data stored on the Solana blockchain.
 * This type mirrors the Rust struct defined in the Solana program.
 * 
 * Fields:
 * - owner: Solana address of the current product owner
 * - serialNumber: Unique identifier for the product
 * - description: Human-readable product description
 * - status: Current status in the supply chain (Created, InTransit, etc.)
 * - createdAt: Unix timestamp of product creation
 * - eventsCounter: Number of events logged for this product
 */
type ProductData = {
  owner: Address
  serialNumber: string
  description: string
  status: ProductStatus
  createdAt: bigint
  eventsCounter: bigint
}

/**
 * PRODUCT ACCOUNT TYPE
 * 
 * Combines product data with Solana account metadata.
 * The Account type from Gill provides blockchain-specific information
 * like the account address, lamport balance, and ownership details.
 */
type ProductAccount = Account<ProductData>

/**
 * SUPPLY CHAIN PROGRAM EXPLORER LINK COMPONENT
 * 
 * Renders a clickable link to view the supply chain program in the Solana Explorer.
 * This provides transparency and allows users to verify the program's authenticity.
 * 
 * Features:
 * - Displays the program ID in ellipsified format for readability
 * - Links directly to the Solana Explorer for the current cluster
 * - Provides easy access to program transaction history and details
 * 
 * @returns JSX element with explorer link
 */
export function SupplyChainProgramExplorerLink() {
  // Get the deployed program's address
  const programId = useSupplyChainProgramId()
  // Render link with shortened address display
  return <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
}

/**
 * PRODUCT LIST COMPONENT
 * 
 * Main component for displaying all products in the supply chain system.
 * Handles loading states, empty states, and responsive layout for product cards.
 * 
 * FEATURES:
 * 
 * 1. DATA FETCHING:
 *    - Uses useProductAccountsQuery to fetch all products from blockchain
 *    - Automatically updates when new products are created
 *    - Handles network errors gracefully
 * 
 * 2. UI STATES:
 *    - Loading spinner during data fetch
 *    - Empty state message when no products exist
 *    - Responsive grid layout for product cards
 * 
 * 3. RESPONSIVE DESIGN:
 *    - Single column on mobile
 *    - Two columns on medium screens (md breakpoint)
 *    - Three columns on large screens (lg breakpoint)
 * 
 * @returns JSX element containing product list or appropriate state message
 */
export function ProductList() {
  /**
   * PRODUCT DATA FETCHING
   * 
   * Query all products from the blockchain using React Query.
   * This provides automatic caching, background updates, and loading states.
   */
  const productsQuery = useProductAccountsQuery()

  /**
   * LOADING STATE
   * 
   * Display animated spinner while products are being fetched from blockchain.
   * Uses Tailwind classes for centered layout and spin animation.
   */
  if (productsQuery.isLoading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  }

  /**
   * EMPTY STATE
   * 
   * When no products exist, display helpful message encouraging users
   * to create their first product. This guides new users through the workflow.
   */
  if (!productsQuery.data?.length) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-semibold mb-2">No Products Found</h2>
        <p className="text-gray-600">Create your first product to get started with supply chain tracking.</p>
      </div>
    )
  }

  /**
   * PRODUCT GRID DISPLAY
   * 
   * Responsive grid layout that adapts to screen size:
   * - Mobile: Single column for optimal touch interaction
   * - Tablet: Two columns for balanced layout
   * - Desktop: Three columns for efficient space usage
   * 
   * Each product is rendered as a ProductCard component with full functionality.
   */
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {productsQuery.data?.map((product) => (
        <ProductCard key={product.address} product={product} />
      ))}
    </div>
  )
}

/**
 * SUPPLY CHAIN PROGRAM GUARD COMPONENT
 * 
 * Guard component that ensures the Solana program is deployed and accessible
 * before rendering child components. Prevents users from accessing functionality
 * when the program is not available.
 * 
 * VALIDATION LOGIC:
 * 
 * 1. Checks if program account exists on the current cluster
 * 2. Shows loading state during program verification
 * 3. Displays error message if program is not found
 * 4. Renders children only when program is confirmed available
 * 
 * This pattern prevents confusing errors and guides users to correct
 * cluster configuration issues.
 * 
 * @param children - Components to render when program is available
 * @returns JSX element with conditional rendering based on program status
 */
export function SupplyChainProgramGuard({ children }: { children: ReactNode }) {
  /**
   * PROGRAM ACCOUNT VERIFICATION
   * 
   * Query the program account to verify it exists and is accessible.
   * This validates that the program is deployed on the current cluster.
   */
  const programAccountQuery = useSupplyChainProgram()

  /**
   * LOADING STATE
   * 
   * Show spinner while verifying program account existence.
   * This prevents premature error messages during network requests.
   */
  if (programAccountQuery.isLoading) {
    return <div className="flex justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
    </div>
  }

  /**
   * PROGRAM NOT FOUND STATE
   * 
   * Display helpful error message when program account is not found.
   * This typically indicates:
   * - Program not deployed on current cluster
   * - Wrong cluster selected in wallet
   * - Network connectivity issues
   * 
   * The yellow styling indicates a warning/configuration issue rather than an error.
   */
  if (!programAccountQuery.data?.value) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <p className="text-yellow-800">
          Program account not found. Make sure you have deployed the program and are on the correct cluster.
        </p>
      </div>
    )
  }

  /**
   * PROGRAM AVAILABLE - RENDER CHILDREN
   * 
   * When program is confirmed available, render the child components.
   * Uses React Fragment to avoid unnecessary DOM nesting.
   */
  return <>{children}</>
}

/**
 * PRODUCT CARD COMPONENT
 * 
 * Individual product display component with comprehensive functionality.
 * This is the primary interface for interacting with products in the system.
 * 
 * FEATURES:
 * 
 * 1. PRODUCT INFORMATION DISPLAY:
 *    - Serial number and status with color coding
 *    - Description and metadata
 *    - Owner information with explorer links
 *    - Event counter for activity tracking
 * 
 * 2. INTERACTIVE FEATURES:
 *    - QR code generation and display
 *    - Event history viewing
 *    - Event logging form
 *    - Ownership transfer form
 * 
 * 3. REAL-TIME UPDATES:
 *    - Queries latest product data for current information
 *    - Automatic refresh after operations
 *    - Live status and event counter updates
 * 
 * 4. RESPONSIVE DESIGN:
 *    - Card-based layout with clear sections
 *    - Collapsible sections to manage screen space
 *    - Touch-friendly button sizing
 * 
 * @param product - Product account data from blockchain
 * @returns JSX element containing complete product interface
 */
function ProductCard({ product }: { product: ProductAccount }) {
  /**
   * UI STATE MANAGEMENT
   * 
   * Local state to control the visibility of different sections:
   * - showEventForm: Controls event logging form display
   * - showTransferForm: Controls ownership transfer form display
   * - showEvents: Controls event history list display
   * - showQRCode: Controls QR code generation and display
   */
  const [showEventForm, setShowEventForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const [showQRCode, setShowQRCode] = useState(false)
  
  /**
   * REAL-TIME PRODUCT DATA
   * 
   * Query the latest product data to ensure UI shows current information.
   * This handles cases where the product has been updated by other users
   * or through other interfaces (like mobile scanning).
   * 
   * Falls back to the passed product data if query is still loading.
   */
  const productQuery = useProductQuery(product.address as Address)
  const currentProduct = productQuery.data || product

  /**
   * STATUS COLOR MAPPING FUNCTION
   * 
   * Maps product status enum values to Tailwind CSS classes for visual indicators.
   * Provides immediate visual feedback about product state in the supply chain.
   * 
   * Color scheme:
   * - Blue: Created (new products)
   * - Yellow: InTransit (products being shipped)
   * - Green: Received/Delivered (completed states)
   * - Purple: Transferred (ownership changed)
   * - Gray: Unknown/default state
   * 
   * @param status - ProductStatus enum value
   * @returns CSS class string for styling status badge
   */
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
    /**
     * MAIN CARD CONTAINER
     * 
     * Uses shadcn/ui Card component for consistent styling and structure.
     * Provides elevation and clear boundaries for product information.
     */
    <Card>
      {/**
       * CARD HEADER SECTION
       * 
       * Contains primary product identification and status information.
       * Uses flexbox for proper alignment between title and status badge.
       */}
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {/**
           * PRODUCT SERIAL NUMBER
           * 
           * Primary identifier displayed prominently.
           * Uses "Product #" prefix for clarity.
           */}
          <span>Product #{currentProduct.data.serialNumber}</span>
          
          {/**
           * STATUS BADGE
           * 
           * Color-coded badge showing current product status.
           * Uses dynamic styling based on status value.
           */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentProduct.data.status)}`}>
            {ProductStatus[currentProduct.data.status]}
          </span>
        </CardTitle>
        
        {/**
         * CARD DESCRIPTION SECTION
         * 
         * Contains detailed product metadata and links.
         * Organized with consistent spacing and typography hierarchy.
         */}
        <CardDescription>
          <div className="space-y-1">
            {/**
             * PRODUCT DESCRIPTION
             * 
             * User-provided description of the product.
             * Primary text styling for readability.
             */}
            <div>{currentProduct.data.description}</div>
            
            {/**
             * OWNER INFORMATION
             * 
             * Links to the product owner's address in Solana Explorer.
             * Allows verification of ownership and transaction history.
             */}
            <div className="text-xs">
              Owner: <ExplorerLink address={currentProduct.data.owner} label={ellipsify(currentProduct.data.owner)} />
            </div>
            
            {/**
             * ACCOUNT ADDRESS
             * 
             * Links to the product account in Solana Explorer.
             * Allows viewing of account details and transaction history.
             */}
            <div className="text-xs">
              Account: <ExplorerLink address={currentProduct.address} label={ellipsify(currentProduct.address)} />
            </div>
            
            {/**
             * EVENT COUNTER
             * 
             * Shows number of events logged for this product.
             * Provides quick indication of product activity level.
             */}
            <div className="text-xs">
              Events: {currentProduct.data.eventsCounter.toString()}
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      
      {/**
       * CARD CONTENT SECTION
       * 
       * Contains interactive elements and expandable sections.
       * Organized with consistent spacing between action buttons.
       */}
      <CardContent>
        <div className="space-y-2">
          {/**
           * QR CODE TOGGLE BUTTON
           * 
           * Shows/hides QR code for the product.
           * Useful for mobile scanning workflows and sharing product links.
           */}
          <Button 
            onClick={() => setShowQRCode(!showQRCode)} 
            variant="outline" 
            className="w-full"
          >
            {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
          </Button>
          
          {/**
           * QR CODE DISPLAY SECTION
           * 
           * Conditionally rendered QR code component.
           * Allows scanning the product for mobile workflows.
           */}
          {showQRCode && (
            <ProductQRCode productAddress={product.address as Address} />
          )}
          
          {/**
           * EVENTS TOGGLE BUTTON
           * 
           * Shows/hides the complete event history for the product.
           * Provides access to full audit trail and supply chain timeline.
           */}
          <Button 
            onClick={() => setShowEvents(!showEvents)} 
            variant="outline" 
            className="w-full"
          >
            {showEvents ? 'Hide Events' : 'View Events'}
          </Button>
          
          {/**
           * EVENTS LIST SECTION
           * 
           * Conditionally rendered events list component.
           * Shows chronological history of all product events.
           */}
          {showEvents && (
            <EventsList productAddress={product.address as Address} />
          )}
          
          {/**
           * LOG EVENT TOGGLE BUTTON
           * 
           * Shows/hides the event logging form.
           * Primary action for updating product status in supply chain.
           */}
          <Button 
            onClick={() => setShowEventForm(!showEventForm)} 
            variant="outline" 
            className="w-full"
          >
            {showEventForm ? 'Cancel' : 'Log Event'}
          </Button>
          
          {/**
           * EVENT LOGGING FORM SECTION
           * 
           * Conditionally rendered form for adding new events.
           * Allows status updates and activity logging.
           */}
          {showEventForm && (
            <LogEventForm 
              productAddress={product.address as Address} 
              onClose={() => setShowEventForm(false)} 
            />
          )}
          
          {/**
           * TRANSFER OWNERSHIP TOGGLE BUTTON
           * 
           * Shows/hides the ownership transfer form.
           * Allows changing product ownership in the supply chain.
           */}
          <Button 
            onClick={() => setShowTransferForm(!showTransferForm)} 
            variant="outline" 
            className="w-full"
          >
            {showTransferForm ? 'Cancel' : 'Transfer Ownership'}
          </Button>
          
          {/**
           * OWNERSHIP TRANSFER FORM SECTION
           * 
           * Conditionally rendered form for changing product ownership.
           * Critical operation for supply chain handoffs.
           */}
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

/**
 * CREATE PRODUCT FORM COMPONENT
 * 
 * Form interface for creating new products in the supply chain system.
 * Handles user input, validation, error states, and blockchain interaction.
 * 
 * FEATURES:
 * 
 * 1. FORM VALIDATION:
 *    - Required field validation
 *    - Character limit enforcement
 *    - Real-time validation feedback
 * 
 * 2. ERROR HANDLING:
 *    - Enhanced error debugging for development
 *    - User-friendly error messages
 *    - Network and permission error handling
 * 
 * 3. LOADING STATES:
 *    - Disabled form during submission
 *    - Loading button text
 *    - Prevents duplicate submissions
 * 
 * 4. USER EXPERIENCE:
 *    - Clear form layout and labeling
 *    - Immediate feedback on validation
 *    - Automatic form reset after success
 * 
 * @returns JSX element containing product creation form
 */
export function CreateProductForm() {
  /**
   * FORM STATE MANAGEMENT
   * 
   * Uses custom hook for form state management including:
   * - serialNumber: Product identifier input
   * - description: Product description input
   * - isValid: Overall form validation state
   * - reset: Function to clear form after successful submission
   */
  const { serialNumber, setSerialNumber, description, setDescription, reset, isValid } = useCreateProductForm()
  
  /**
   * BLOCKCHAIN MUTATION
   * 
   * React Query mutation for creating products on the blockchain.
   * Handles transaction signing, submission, and state updates.
   */
  const createProductMutation = useInitializeProductMutation()
  
  /**
   * ERROR STATE FOR DEBUGGING
   * 
   * Enhanced error state for development and debugging.
   * Captures additional error information for troubleshooting.
   */
  const [lastError, setLastError] = useState<any>(null)

  /**
   * FORM SUBMISSION HANDLER
   * 
   * Handles form submission with comprehensive error handling and user feedback.
   * 
   * Process:
   * 1. Validate form inputs
   * 2. Clear any previous errors
   * 3. Submit to blockchain via mutation
   * 4. Reset form on success
   * 5. Handle and display any errors
   * 
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default browser form submission
    e.preventDefault()
    
    // Validate form before proceeding
    if (!isValid) return
    
    try {
      // Clear any previous error state
      setLastError(null)
      
      /**
       * BLOCKCHAIN TRANSACTION SUBMISSION
       * 
       * Submit the product creation transaction to the blockchain.
       * This will trigger wallet signing and network submission.
       */
      await createProductMutation.mutateAsync({ serialNumber, description })
      
      /**
       * SUCCESS HANDLING
       * 
       * Reset the form to initial state after successful creation.
       * The mutation's onSuccess handler will update the UI automatically.
       */
      reset()
    } catch (error) {
      /**
       * ERROR HANDLING AND DEBUGGING
       * 
       * Capture error for debugging and provide enhanced error information.
       * This is particularly useful for mobile development and troubleshooting.
       */
      setLastError(error)
      console.error('Error creating product:', error)
      
      // Enhanced error debugging information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          cause: error.cause,
        })
      }
      
      /**
       * USER AGENT DETECTION FOR DEBUGGING
       * 
       * Capture browser/device information for mobile-specific issues.
       * Helps identify platform-specific problems.
       */
      console.error('Browser info:', {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
      })
    }
  }

  return (
    /**
     * FORM CONTAINER CARD
     * 
     * Uses card layout for visual separation and professional appearance.
     * Consistent with other form components in the application.
     */
    <Card>
      <CardHeader>
        <CardTitle>Create New Product</CardTitle>
        <CardDescription>
          Register a new product in the supply chain tracking system
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {/**
         * MAIN FORM ELEMENT
         * 
         * Standard HTML form with React event handling.
         * Uses onSubmit for proper form validation and accessibility.
         */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/**
           * SERIAL NUMBER INPUT SECTION
           * 
           * Primary identifier for the product.
           * Required field with character limit validation.
           */}
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
          
          {/**
           * DESCRIPTION INPUT SECTION
           * 
           * Detailed product description for identification.
           * Required field with character limit validation.
           */}
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
          
          {/**
           * SUBMIT BUTTON
           * 
           * Primary action button with loading state and validation.
           * Disabled during submission to prevent duplicate transactions.
           */}
          <Button 
            type="submit" 
            disabled={!isValid || createProductMutation.isPending}
            className="w-full"
          >
            {createProductMutation.isPending ? 'Creating Product...' : 'Create Product'}
          </Button>
          
          {/**
           * ERROR DISPLAY SECTION
           * 
           * Development-only error display for debugging.
           * Shows detailed error information in non-production environments.
           */}
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

/**
 * LOG EVENT FORM COMPONENT
 * 
 * Inline form for logging events to existing products.
 * Provides a streamlined interface for updating product status and adding activity records.
 * 
 * FEATURES:
 * 
 * 1. EVENT TYPE SELECTION:
 *    - Dropdown with predefined event types
 *    - Common supply chain events (Created, Shipped, Received, etc.)
 *    - Custom "Other" option for flexibility
 * 
 * 2. DESCRIPTION INPUT:
 *    - Free-text description for event details
 *    - Required field with character limit
 *    - Context-specific placeholder text
 * 
 * 3. FORM MANAGEMENT:
 *    - Compact inline design
 *    - Validation and error handling
 *    - Auto-close on successful submission
 * 
 * @param productAddress - Address of the product to log event for
 * @param onClose - Callback function to close the form
 * @returns JSX element containing event logging form
 */
function LogEventForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  /**
   * FORM STATE MANAGEMENT
   * 
   * Uses custom hook for event form state including:
   * - eventType: Selected event type from dropdown
   * - description: Event description text
   * - isValid: Form validation state
   * - reset: Function to clear form after submission
   */
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  
  /**
   * BLOCKCHAIN MUTATION
   * 
   * React Query mutation for logging events to the blockchain.
   * Handles transaction creation, signing, and submission.
   */
  const logEventMutation = useLogEventMutation()

  /**
   * FORM SUBMISSION HANDLER
   * 
   * Handles event logging with validation and error handling.
   * 
   * Process:
   * 1. Validate form inputs
   * 2. Submit event to blockchain
   * 3. Reset form and close on success
   * 4. Handle any submission errors
   * 
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default browser form submission
    e.preventDefault()
    
    // Validate form before proceeding
    if (!isValid) return

    try {
      /**
       * BLOCKCHAIN EVENT SUBMISSION
       * 
       * Submit the event logging transaction to the blockchain.
       * Includes product address, event type, and description.
       */
      await logEventMutation.mutateAsync({ productAddress, eventType, description })
      
      /**
       * SUCCESS HANDLING
       * 
       * Reset form state and close the form after successful submission.
       * The mutation's onSuccess handler will update the UI automatically.
       */
      reset()
      onClose()
    } catch (error) {
      /**
       * ERROR LOGGING
       * 
       * Log errors for debugging while letting the mutation's
       * error handler manage user-facing error messages.
       */
      console.error('Error logging event:', error)
    }
  }

  return (
    /**
     * INLINE FORM CONTAINER
     * 
     * Compact form design with border for visual separation.
     * Designed to fit within product cards without overwhelming the layout.
     */
    <div className="border rounded-lg p-4 bg-white">
      {/**
       * FORM HEADER
       * 
       * Simple header with close button for form management.
       * Provides clear context and exit option.
       */}
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

      {/**
       * MAIN FORM ELEMENT
       * 
       * Compact form layout optimized for inline display.
       * Uses consistent spacing and validation patterns.
       */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/**
         * EVENT TYPE SELECTION
         * 
         * Dropdown selector for predefined event types.
         * Maps to EventType enum values from the blockchain program.
         */}
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
        
        {/**
         * EVENT DESCRIPTION INPUT
         * 
         * Free-text input for event details and context.
         * Required field with character limit for blockchain efficiency.
         */}
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
        
        {/**
         * SUBMIT BUTTON
         * 
         * Primary action button with loading state and validation.
         * Full width for easy touch interaction on mobile devices.
         */}
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

/**
 * TRANSFER OWNERSHIP FORM COMPONENT
 * 
 * Inline form for transferring product ownership to a new address.
 * Handles validation of Solana addresses and blockchain transaction submission.
 * 
 * FEATURES:
 * 
 * 1. ADDRESS VALIDATION:
 *    - Validates Solana address format
 *    - Prevents transfers to invalid addresses
 *    - Clear error messaging for invalid inputs
 * 
 * 2. SECURITY CONSIDERATIONS:
 *    - Confirms current user is authorized to transfer
 *    - Irreversible operation with clear warnings
 *    - Transaction must be signed by current owner
 * 
 * 3. USER EXPERIENCE:
 *    - Compact inline form design
 *    - Clear labeling and placeholder text
 *    - Loading states during transaction processing
 * 
 * @param productAddress - Address of the product to transfer
 * @param onClose - Callback function to close the form
 * @returns JSX element containing ownership transfer form
 */
function TransferOwnershipForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  /**
   * FORM STATE MANAGEMENT
   * 
   * Simple local state for the new owner address input.
   * Uses controlled component pattern for form validation.
   */
  const [newOwner, setNewOwner] = useState('')
  
  /**
   * BLOCKCHAIN MUTATION
   * 
   * React Query mutation for ownership transfer transactions.
   * Handles transaction creation, signing, and blockchain submission.
   */
  const transferMutation = useTransferOwnershipMutation()

  /**
   * FORM SUBMISSION HANDLER
   * 
   * Handles ownership transfer with address validation and error handling.
   * 
   * Process:
   * 1. Validate new owner address format
   * 2. Submit transfer transaction to blockchain
   * 3. Close form on successful transfer
   * 4. Handle any transaction errors
   * 
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default browser form submission
    e.preventDefault()
    
    // Validate that new owner address is provided
    if (!newOwner.trim()) return

    try {
      /**
       * BLOCKCHAIN TRANSFER SUBMISSION
       * 
       * Submit the ownership transfer transaction to the blockchain.
       * The new owner address is cast to Address type for type safety.
       */
      await transferMutation.mutateAsync({ 
        productAddress, 
        newOwner: newOwner.trim() as Address 
      })
      
      /**
       * SUCCESS HANDLING
       * 
       * Close the form after successful transfer.
       * The mutation's onSuccess handler will update the UI automatically.
       */
      onClose()
    } catch (error) {
      /**
       * ERROR LOGGING
       * 
       * Log errors for debugging while letting the mutation's
       * error handler manage user-facing error messages.
       */
      console.error('Error transferring ownership:', error)
    }
  }

  return (
    /**
     * INLINE FORM CONTAINER
     * 
     * Compact form design consistent with other inline forms.
     * Uses border and background for visual separation.
     */
    <div className="border rounded-lg p-4 bg-white">
      {/**
       * FORM HEADER WITH WARNING
       * 
       * Header includes close button and warning about irreversible operation.
       * Critical to inform users about the permanent nature of ownership transfer.
       */}
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
      
      {/**
       * WARNING MESSAGE
       * 
       * Important notice about the irreversible nature of ownership transfer.
       * Styled with warning colors to ensure user attention.
       */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800 text-sm">
          <strong>Warning:</strong> Ownership transfer is irreversible. Make sure the new owner address is correct.
        </p>
      </div>

      {/**
       * MAIN FORM ELEMENT
       * 
       * Simple form with address input and submission button.
       * Optimized for quick ownership changes.
       */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/**
         * NEW OWNER ADDRESS INPUT
         * 
         * Input field for the recipient's Solana address.
         * Includes helpful placeholder text and validation.
         */}
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
        
        {/**
         * SUBMIT BUTTON
         * 
         * Transfer action button with loading state and validation.
         * Disabled when no address is provided or transaction is pending.
         */}
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

/**
 * EVENTS LIST COMPONENT
 * 
 * Displays chronological history of all events for a specific product.
 * Provides complete audit trail with timestamps and event details.
 * 
 * FEATURES:
 * 
 * 1. CHRONOLOGICAL DISPLAY:
 *    - Events sorted by creation order
 *    - Clear timestamp formatting
 *    - Sequential event indexing
 * 
 * 2. EVENT TYPE VISUALIZATION:
 *    - Color-coded event types
 *    - Visual hierarchy for different event types
 *    - Consistent with status color scheme
 * 
 * 3. RESPONSIVE DESIGN:
 *    - Scrollable container for long event lists
 *    - Fixed height to prevent layout issues
 *    - Mobile-optimized touch scrolling
 * 
 * 4. LOADING AND EMPTY STATES:
 *    - Loading spinner during data fetch
 *    - Clear message when no events exist
 *    - Error handling for failed requests
 * 
 * @param productAddress - Address of the product to show events for
 * @returns JSX element containing events list or appropriate state message
 */
function EventsList({ productAddress }: { productAddress: Address }) {
  /**
   * EVENTS DATA FETCHING
   * 
   * Query all events for the specified product using React Query.
   * Provides automatic caching, loading states, and error handling.
   */
  const eventsQuery = useProductEventsQuery(productAddress)

  /**
   * EVENT TYPE COLOR MAPPING FUNCTION
   * 
   * Maps event type enum values to CSS classes for visual distinction.
   * Consistent with product status colors for unified design language.
   * 
   * @param eventType - EventType enum value
   * @returns CSS class string for styling event type badge
   */
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

  /**
   * LOADING STATE
   * 
   * Display spinner while events are being fetched from blockchain.
   * Centered within the container for consistent experience.
   */
  if (eventsQuery.isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  /**
   * EMPTY STATE
   * 
   * Message displayed when no events exist for the product.
   * Encourages users to log the first event.
   */
  if (!eventsQuery.data?.length) {
    return (
      <div className="text-center p-4 text-gray-500">
        No events logged yet. Log the first event to start tracking this product.
      </div>
    )
  }

  return (
    /**
     * SCROLLABLE EVENTS CONTAINER
     * 
     * Fixed height container with scrolling for long event lists.
     * Prevents the card from becoming too tall while maintaining access to all events.
     */
    <div className="max-h-64 overflow-y-auto border rounded-lg">
      <div className="space-y-2 p-3">
        {/**
         * EVENTS LIST MAPPING
         * 
         * Render each event with consistent formatting and styling.
         * Events are already sorted chronologically by the query.
         */}
        {eventsQuery.data.map((event, index) => (
          /**
           * INDIVIDUAL EVENT ITEM
           * 
           * Each event displayed as a separate item with complete information.
           * Uses index as key since events are immutable and ordered.
           */
          <div key={index} className="border-b last:border-b-0 pb-2 last:pb-0">
            {/**
             * EVENT HEADER
             * 
             * Contains event type badge and sequence number.
             * Provides quick identification of event type and order.
             */}
            <div className="flex items-center justify-between mb-1">
              {/**
               * EVENT TYPE BADGE
               * 
               * Color-coded badge showing the type of event.
               * Uses consistent styling with status indicators.
               */}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.data.eventType)}`}>
                {EventType[event.data.eventType]}
              </span>
              
              {/**
               * EVENT INDEX
               * 
               * Shows the sequential number of this event.
               * Helps understand the chronological order.
               */}
              <span className="text-xs text-gray-500">
                Event #{event.data.eventIndex.toString()}
              </span>
            </div>
            
            {/**
             * EVENT DESCRIPTION
             * 
             * User-provided description of what happened in this event.
             * Primary content for understanding the event context.
             */}
            <p className="text-sm mb-1">{event.data.description}</p>
            
            {/**
             * EVENT TIMESTAMP
             * 
             * Formatted timestamp showing when the event was logged.
             * Uses standard date/time formatting for clarity.
             */}
            <p className="text-xs text-gray-500">
              {new Date(Number(event.data.timestamp) * 1000).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * PRODUCT QR CODE COMPONENT
 * 
 * Generates and displays QR codes for products with download functionality.
 * Enables mobile scanning workflows and easy product sharing.
 * 
 * FEATURES:
 * 
 * 1. QR CODE GENERATION:
 *    - URL-based QR codes linking to the application
 *    - High error correction for reliable scanning
 *    - Optimized size and contrast for mobile cameras
 * 
 * 2. DOWNLOAD FUNCTIONALITY:
 *    - Download QR code as PNG image
 *    - Filename includes product address for organization
 *    - Useful for printing labels or sharing offline
 * 
 * 3. RESPONSIVE DESIGN:
 *    - Mobile-optimized QR code size
 *    - Proper scaling for different screen sizes
 *    - Clear product address display for verification
 * 
 * 4. ERROR HANDLING:
 *    - Loading states during generation
 *    - Error messages for generation failures
 *    - Graceful fallbacks for unsupported browsers
 * 
 * @param productAddress - Address of the product to generate QR code for
 * @returns JSX element containing QR code display and download functionality
 */
function ProductQRCode({ productAddress }: { productAddress: Address }) {
  /**
   * COMPONENT STATE MANAGEMENT
   * 
   * Local state for QR code generation and display:
   * - qrCodeDataURL: Base64 data URL of generated QR code image
   * - isGenerating: Loading state during QR code generation
   * - error: Error message if generation fails
   */
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')

  /**
   * QR CODE GENERATION EFFECT
   * 
   * Automatically generates QR code when component mounts or product address changes.
   * Uses async function within useEffect for proper error handling.
   */
  useEffect(() => {
    /**
     * ASYNC QR CODE GENERATION FUNCTION
     * 
     * Generates QR code containing URL that links to the application
     * with the product address as a query parameter.
     */
    const generateQRCode = async () => {
      // Set loading state
      setIsGenerating(true)
      try {
        /**
         * QR CODE URL CONSTRUCTION
         * 
         * Creates URL that links back to the application with the product
         * address as a scan parameter. Uses URL encoding for safety.
         */
        const qrData = `${window.location.origin}/supply_chain?scan=${encodeURIComponent(productAddress)}`
        
        /**
         * QR CODE GENERATION
         * 
         * Uses the qrcode library with predefined configuration.
         * Returns a base64 data URL that can be used directly in img src.
         */
        const dataURL = await QRCode.toDataURL(qrData, QR_CODE_CONFIG)
        
        // Set the generated QR code data URL
        setQrCodeDataURL(dataURL)
        // Clear any previous errors
        setError('')
      } catch (err) {
        /**
         * ERROR HANDLING
         * 
         * Capture and display any errors that occur during QR code generation.
         * Provides user feedback and debugging information.
         */
        console.error('Error generating QR code:', err)
        setError('Failed to generate QR code')
      } finally {
        // Clear loading state regardless of success or failure
        setIsGenerating(false)
      }
    }

    // Trigger QR code generation
    generateQRCode()
  }, [productAddress]) // Regenerate when product address changes

  /**
   * QR CODE DOWNLOAD HANDLER
   * 
   * Allows users to download the QR code as a PNG file.
   * Useful for printing labels or sharing offline.
   */
  const handleDownload = () => {
    // Ensure QR code is generated before attempting download
    if (!qrCodeDataURL) return

    /**
     * DOWNLOAD LINK CREATION
     * 
     * Creates a temporary download link and triggers the download.
     * Uses product address in filename for easy organization.
     */
    const link = document.createElement('a')
    link.href = qrCodeDataURL
    link.download = `product-${productAddress}-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * LOADING STATE DISPLAY
   * 
   * Show spinner while QR code is being generated.
   * Prevents layout shift and provides user feedback.
   */
  if (isGenerating) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  /**
   * ERROR STATE DISPLAY
   * 
   * Show error message if QR code generation fails.
   * Styled with error colors for clear feedback.
   */
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    )
  }

  return (
    /**
     * QR CODE DISPLAY CONTAINER
     * 
     * Contains the generated QR code image with download functionality.
     * Centered layout with clear product information.
     */
    <div className="flex flex-col items-center space-y-3 p-4 bg-gray-50 rounded-lg">
      {/**
       * QR CODE IMAGE
       * 
       * Displays the generated QR code with optimal sizing for scanning.
       * Uses Next.js Image component for optimization (fallback to img for data URLs).
       */}
      {qrCodeDataURL && (
        <img 
          src={qrCodeDataURL} 
          alt={`QR Code for product ${productAddress}`}
          className="w-48 h-48 border border-gray-200 rounded"
        />
      )}
      
      {/**
       * PRODUCT ADDRESS DISPLAY
       * 
       * Shows the full product address for verification.
       * Helps users confirm they're scanning the correct product.
       */}
      <p className="text-xs text-gray-600 text-center font-mono break-all">
        Product: {productAddress}
      </p>
      
      {/**
       * DOWNLOAD BUTTON
       * 
       * Allows users to download the QR code as an image file.
       * Useful for printing or offline sharing.
       */}
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

/**
 * QR CODE SCANNER COMPONENT
 * 
 * Advanced QR code scanner with mobile optimization and camera integration.
 * Enables rapid product identification and seamless event logging workflows.
 * 
 * FEATURES:
 * 
 * 1. MOBILE OPTIMIZATION:
 *    - Device detection for mobile-specific behavior
 *    - Performance optimization for mobile cameras
 *    - Touch-friendly interface design
 *    - Battery-conscious scanning rates
 * 
 * 2. CAMERA INTEGRATION:
 *    - Environment-facing (back) camera preference
 *    - Permission handling with clear error messages
 *    - Multiple video resolution support
 *    - Automatic camera cleanup on component unmount
 * 
 * 3. SCANNING PERFORMANCE:
 *    - Throttled scanning to prevent excessive processing
 *    - Different scan rates for mobile vs desktop
 *    - Visual feedback with scan region highlighting
 *    - Immediate response to successful scans
 * 
 * 4. URL AND ADDRESS PARSING:
 *    - Supports application URLs with scan parameters
 *    - Direct Solana address scanning as fallback
 *    - URL decoding for proper address extraction
 *    - Validation of scanned data format
 * 
 * 5. ERROR HANDLING:
 *    - Comprehensive camera error types
 *    - User-friendly error messages
 *    - Permission troubleshooting guidance
 *    - Network and hardware error handling
 * 
 * @returns JSX element containing QR scanner interface or scanned product form
 */
export function QRScanner() {
  /**
   * COMPONENT STATE MANAGEMENT
   * 
   * Manages scanning state, scanned data, errors, and device detection:
   * - isScanning: Controls camera activation and scanning process
   * - scannedProductAddress: Stores successfully scanned product address
   * - error: Error message for display to user
   * - isMobileDevice: Device detection for mobile-specific optimizations
   */
  const [isScanning, setIsScanning] = useState(false)
  const [scannedProductAddress, setScannedProductAddress] = useState<Address | null>(null)
  const [error, setError] = useState('')
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  
  /**
   * DOM REFERENCES
   * 
   * References for DOM manipulation and cleanup:
   * - videoRef: Reference to video element for camera display
   * - scanningTimeoutRef: Reference to timeout for cleanup
   */
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanningTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * SCANNING CONTROL FUNCTION
   * 
   * Stops the scanning process and cleans up resources.
   * Used when scan is successful, cancelled, or encounters errors.
   */
  const stopScanning = useCallback(() => {
    setIsScanning(false)
    if (scanningTimeoutRef.current) {
      clearTimeout(scanningTimeoutRef.current)
      scanningTimeoutRef.current = null
    }
  }, [])

  /**
   * MOBILE DEVICE DETECTION EFFECT
   * 
   * Detects mobile devices for performance and UI optimizations.
   * Uses user agent string analysis for device identification.
   */
  useEffect(() => {
    /**
     * DEVICE DETECTION FUNCTION
     * 
     * Analyzes user agent string to identify mobile devices.
     * Covers major mobile platforms and browsers.
     */
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as Window & typeof globalThis & { opera?: string }).opera || ''
      return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())
    }
    setIsMobileDevice(checkMobile())
  }, [])

  /**
   * QR SCANNER INITIALIZATION EFFECT
   * 
   * Sets up the QR scanner when scanning is enabled.
   * Handles camera access, scanner configuration, and cleanup.
   */
  useEffect(() => {
    // Only initialize scanner when scanning is active
    if (!isScanning) {
      return
    }

    // Scanner instance variable
    let qrScanner: QrScanner | null = null
    // Throttling variable for performance optimization
    let lastScanTime = 0

    // Get video element reference
    const videoEl = videoRef.current
    if (videoEl) {
      /**
       * MOBILE CAMERA SETUP
       * 
       * For mobile devices, manually request camera access with optimized constraints.
       * This provides better control over camera configuration than the scanner's
       * automatic setup.
       */
      if (isMobileDevice) {
        navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
          .then(stream => {
            videoEl.srcObject = stream
          })
          .catch(err => {
            console.error('Mobile camera setup error:', err)
            setError('Failed to access camera. Please ensure camera permissions are granted.')
          })
      }

      /**
       * THROTTLED SCAN RESULT HANDLER
       * 
       * Processes QR scan results with throttling to prevent excessive processing.
       * Handles URL parsing and direct address validation.
       * 
       * @param result - QR scan result from the scanner
       */
      const throttledScanResult = (result: QrScanner.ScanResult) => {
        const currentTime = Date.now()
        // Throttle scans based on configured interval
        if (currentTime - lastScanTime < SCAN_THROTTLE_MS) {
          return
        }
        lastScanTime = currentTime

        // Extract scanned data
        const resultData = result.data
        try {
          /**
           * URL PARSING ATTEMPT
           * 
           * First, try to parse the scanned data as a URL.
           * Look for the 'scan' parameter containing the product address.
           */
          const url = new URL(resultData)
          const productAddress = url.searchParams.get('scan')
          if (productAddress) {
            // Decode the URL-encoded product address
            const decodedAddress = decodeURIComponent(productAddress)
            setScannedProductAddress(decodedAddress as Address)
            stopScanning()
          } else {
            setError('Invalid QR code. Please scan a product QR code.')
          }
        } catch {
          /**
           * DIRECT ADDRESS PARSING FALLBACK
           * 
           * If URL parsing fails, attempt to treat the scanned data
           * as a direct Solana address. Validates address length.
           */
          if (resultData.length >= 32 && resultData.length <= 44) {
            setScannedProductAddress(resultData as Address)
            stopScanning()
          } else {
            setError('Invalid QR code format.')
          }
        }
      }

      /**
       * QR SCANNER INITIALIZATION
       * 
       * Creates and configures the QrScanner instance with mobile optimizations.
       * Sets up event handlers and scanning parameters.
       */
      qrScanner = new QrScanner(
        videoEl,
        throttledScanResult,
        {
          returnDetailedScanResult: true,           // Get detailed scan information
          highlightScanRegion: true,               // Show scan region overlay
          highlightCodeOutline: true,              // Highlight detected QR codes
          // Adjust scan rate based on device type for performance
          maxScansPerSecond: isMobileDevice ? MOBILE_MAX_SCANS_PER_SECOND : DESKTOP_MAX_SCANS_PER_SECOND,
          preferredCamera: 'environment'           // Use back camera for scanning
        }
      )

      /**
       * SCANNER START WITH ERROR HANDLING
       * 
       * Starts the camera and scanner with comprehensive error handling.
       * Provides specific error messages for different failure types.
       */
      qrScanner.start().catch((err) => {
        console.error('Camera error:', err)
        let errorMessage = 'Camera error: '
        
        /**
         * CAMERA ERROR TYPE HANDLING
         * 
         * Provides specific error messages based on the type of camera error.
         * Helps users understand and resolve camera access issues.
         */
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

    /**
     * CLEANUP FUNCTION
     * 
     * Destroys the scanner and cleans up resources when component unmounts
     * or scanning is stopped. Prevents memory leaks and camera access issues.
     */
    return () => {
      qrScanner?.destroy()
      if (scanningTimeoutRef.current) {
        clearTimeout(scanningTimeoutRef.current)
      }
    }
  }, [isScanning, stopScanning, isMobileDevice])

  /**
   * SCANNED PRODUCT FORM DISPLAY
   * 
   * When a product address is successfully scanned, display the mobile-optimized
   * event logging form instead of the scanner interface.
   */
  if (scannedProductAddress) {
    return (
      <MobileScanEventForm
        productAddress={scannedProductAddress}
        onClose={() => setScannedProductAddress(null)}
      />
    )
  }

  return (
    /**
     * SCANNER MAIN CONTAINER
     * 
     * Card-based layout for the QR scanner interface.
     * Provides clear visual boundaries and professional appearance.
     */
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4 text-center">QR Code Scanner</h3>

      {/**
       * SCANNER STATE CONDITIONAL RENDERING
       * 
       * Shows different content based on whether scanning is active or inactive.
       */}
      {!isScanning ? (
        /**
         * INACTIVE SCANNER STATE
         * 
         * Display start button and instructions when scanner is not active.
         * Provides clear call-to-action and usage guidance.
         */
        <div className="text-center space-y-4">
          <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-600 mb-4">Scan a product QR code to log events</p>
            <Button onClick={() => {
              setError('')
              setIsScanning(true)
            }}>
              Start Scanning
            </Button>
          </div>
          
          {/**
           * ERROR MESSAGE DISPLAY
           * 
           * Show any camera or scanning errors with appropriate styling.
           */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>
      ) : (
        /**
         * ACTIVE SCANNER STATE
         * 
         * Display camera feed and scanning interface when scanner is active.
         * Optimized for mobile device usage and touch interaction.
         */
        <div className="space-y-4">
          {/**
           * CAMERA VIDEO ELEMENT
           * 
           * Video element for displaying camera feed.
           * Configured with responsive sizing and proper aspect ratio.
           */}
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-64 bg-black rounded-lg object-cover"
              playsInline
              muted
            />
            
            {/**
             * SCANNING OVERLAY
             * 
             * Visual overlay indicating scanning area and providing user guidance.
             * Positioned absolutely over the video feed.
             */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white rounded-lg p-4 bg-black bg-opacity-30">
                <p className="text-white text-sm text-center">
                  Point camera at QR code
                </p>
              </div>
            </div>
          </div>
          
          {/**
           * SCANNER CONTROLS
           * 
           * Button to stop scanning and return to initial state.
           * Provides escape route for users who want to cancel.
           */}
          <div className="text-center">
            <Button 
              onClick={stopScanning}
              variant="outline"
            >
              Stop Scanning
            </Button>
          </div>
          
          {/**
           * MOBILE USAGE HINTS
           * 
           * Additional guidance for mobile users on proper scanning technique.
           * Helps improve scan success rate and user experience.
           */}
          {isMobileDevice && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm text-center">
                <strong>Tip:</strong> Hold your device steady and ensure the QR code is well-lit for best results.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * MOBILE SCAN EVENT FORM COMPONENT
 * 
 * Mobile-optimized form for logging events after QR code scanning.
 * Designed specifically for mobile workflows with enhanced UX and validation.
 * 
 * FEATURES:
 * 
 * 1. MOBILE-FIRST DESIGN:
 *    - Touch-friendly form elements with larger targets
 *    - Optimized layout for mobile screens
 *    - Enhanced form field sizing for easier interaction
 * 
 * 2. PRODUCT CONTEXT DISPLAY:
 *    - Shows scanned product information for verification
 *    - Owner validation with visual authorization indicators
 *    - Clear product identification before event logging
 * 
 * 3. AUTHORIZATION CHECKING:
 *    - Validates wallet connection before form submission
 *    - Checks if current user is authorized to log events
 *    - Visual indicators for ownership status
 * 
 * 4. ENHANCED ERROR HANDLING:
 *    - Specific error messages for wallet connection issues
 *    - Authorization error handling with clear guidance
 *    - Network and transaction error management
 * 
 * 5. SEAMLESS WORKFLOW:
 *    - Direct integration with QR scanning results
 *    - One-step process from scan to event logging
 *    - Immediate feedback and form closure on success
 * 
 * @param productAddress - Address of the scanned product
 * @param onClose - Callback function to close the form and return to scanner
 * @returns JSX element containing mobile-optimized event logging form
 */
function MobileScanEventForm({ productAddress, onClose }: { 
  productAddress: Address; 
  onClose: () => void 
}) {
  /**
   * FORM STATE MANAGEMENT
   * 
   * Uses the same form hook as the desktop version for consistency.
   * Provides event type selection, description input, and validation.
   */
  const { eventType, setEventType, description, setDescription, reset, isValid } = useLogEventForm()
  
  /**
   * BLOCKCHAIN AND WALLET INTEGRATION
   * 
   * Access to mutation for event logging and wallet state for authorization.
   */
  const logEventMutation = useLogEventMutation()
  const productQuery = useProductQuery(productAddress)
  const { account } = useWalletUi()

  /**
   * FORM SUBMISSION HANDLER
   * 
   * Enhanced submission handler with mobile-specific considerations.
   * Includes comprehensive validation and error handling.
   * 
   * Process:
   * 1. Validate form inputs and wallet connection
   * 2. Check authorization (user must be product owner)
   * 3. Submit event logging transaction
   * 4. Handle success/error scenarios appropriately
   * 
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // Prevent default browser form submission
    e.preventDefault()
    
    // Validate form inputs
    if (!isValid) return

    /**
     * WALLET CONNECTION VALIDATION
     * 
     * Ensure wallet is connected before attempting any blockchain operations.
     * Critical for mobile workflows where wallet state might be unstable.
     */
    if (!account) {
      console.error('Wallet not connected')
      alert('Please connect your wallet first')
      return
    }

    /**
     * AUTHORIZATION VALIDATION
     * 
     * Check if the current wallet address matches the product owner.
     * Only product owners can log events for their products.
     */
    if (productQuery.data && productQuery.data.data.owner !== account.address) {
      alert(`Only the product owner can log events. Owner: ${productQuery.data.data.owner}, Current wallet: ${account.address}`)
      return
    }

    try {
      /**
       * BLOCKCHAIN EVENT SUBMISSION
       * 
       * Submit the event logging transaction to the blockchain.
       * Uses the same mutation as the desktop version for consistency.
       */
      await logEventMutation.mutateAsync({ productAddress, eventType, description })
      
      /**
       * SUCCESS HANDLING
       * 
       * Reset form state and close the form after successful submission.
       * Returns user to the scanner interface for additional scanning.
       */
      reset()
      onClose()
    } catch (error) {
      /**
       * ENHANCED ERROR HANDLING
       * 
       * Provides specific error handling for mobile scenarios.
       * Includes wallet connection issues and authorization errors.
       */
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
    /**
     * MOBILE FORM CONTAINER
     * 
     * Clean container design optimized for mobile viewing.
     * Uses border and background for visual separation from scanner.
     */
    <div className="border rounded-lg p-4 bg-white">
      {/**
       * FORM HEADER WITH CLOSE BUTTON
       * 
       * Header section with form title and close functionality.
       * Close button returns user to scanner interface.
       */}
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

      {/**
       * PRODUCT INFORMATION DISPLAY
       * 
       * Shows details of the scanned product for user verification.
       * Includes product info, status, and ownership details.
       */}
      {productQuery.data && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-sm">
            {/**
             * PRODUCT IDENTIFICATION
             * 
             * Primary product information for verification.
             */}
            <div className="font-medium">Product #{productQuery.data.data.serialNumber}</div>
            <div className="text-gray-600">{productQuery.data.data.description}</div>
            
            {/**
             * PRODUCT STATUS DISPLAY
             * 
             * Current status with color-coded indicator.
             * Uses the same color scheme as the main product cards.
             */}
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
            
            {/**
             * OWNERSHIP INFORMATION AND AUTHORIZATION INDICATOR
             * 
             * Shows product owner and indicates whether current user is authorized.
             * Provides clear visual feedback about permission status.
             */}
            <div className="text-xs text-gray-500 mt-1">
              Owner: <span className="font-mono">{ellipsify(productQuery.data.data.owner)}</span>
              {/**
               * AUTHORIZED USER INDICATOR
               * 
               * Green badge when current wallet owns the product.
               */}
              {account && productQuery.data.data.owner === account.address && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  You own this product
                </span>
              )}
              {/**
               * UNAUTHORIZED USER INDICATOR
               * 
               * Red badge when current wallet does not own the product.
               */}
              {account && productQuery.data.data.owner !== account.address && (
                <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                  Not authorized
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/**
       * MAIN EVENT LOGGING FORM
       * 
       * Mobile-optimized form with larger touch targets and clear labeling.
       */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/**
         * EVENT TYPE SELECTION
         * 
         * Dropdown with larger padding for mobile touch interaction.
         * Includes all available event types for supply chain tracking.
         */}
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
        
        {/**
         * EVENT DESCRIPTION INPUT
         * 
         * Text input with enhanced mobile styling and validation.
         * Larger padding for easier touch interaction.
         */}
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
        
        {/**
         * SUBMIT BUTTON
         * 
         * Full-width button with enhanced mobile styling.
         * Disabled when form is invalid or transaction is pending.
         */}
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