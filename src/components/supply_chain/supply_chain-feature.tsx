/**
 * SUPPLY CHAIN FEATURE COMPONENT
 * 
 * This is the main entry point component for the supply chain tracking application.
 * It orchestrates the overall layout and user experience for managing products
 * and events in a blockchain-based supply chain system.
 * 
 * KEY RESPONSIBILITIES:
 * 
 * 1. LAYOUT ORCHESTRATION:
 *    - Provides the main page structure and hero section
 *    - Organizes major functional areas (QR scanning, product creation, product list)
 *    - Handles responsive design and spacing between sections
 * 
 * 2. AUTHENTICATION STATE MANAGEMENT:
 *    - Conditionally renders content based on wallet connection status
 *    - Shows wallet connection prompt for unauthenticated users
 *    - Reveals full functionality only for connected wallets
 * 
 * 3. PROGRAM VALIDATION:
 *    - Wraps content in SupplyChainProgramGuard to ensure program availability
 *    - Provides fallback UI when the Solana program is not accessible
 *    - Handles different deployment environments (devnet, testnet, mainnet)
 * 
 * 4. USER EXPERIENCE FLOW:
 *    - Guides users through the wallet connection process
 *    - Presents features in logical order (scan → create → manage)
 *    - Provides clear calls-to-action and contextual information
 * 
 * COMPONENT ARCHITECTURE:
 * 
 * This component follows a "container" pattern where it:
 * - Handles high-level state and routing logic
 * - Delegates specific functionality to specialized child components
 * - Manages the overall user workflow and navigation
 * - Provides consistent branding and messaging
 */

// Import wallet connection button from the Solana provider
import { WalletButton } from '../solana/solana-provider'
// Import all the main functional components for supply chain operations
import { 
  CreateProductForm,               // Form for creating new products
  ProductList,                     // Display and management of existing products
  SupplyChainProgramExplorerLink, // Link to view program on Solana explorer
  SupplyChainProgramGuard,        // Guard component that ensures program availability
  QRScanner                       // QR code scanning interface for mobile workflows
} from './supply_chain-ui'
// Import hero section component for page header
import { AppHero } from '../app-hero'
// Import wallet connection hook
import { useWalletUi } from '@wallet-ui/react'

/**
 * MAIN SUPPLY CHAIN FEATURE COMPONENT
 * 
 * This component renders the complete supply chain tracking interface.
 * It adapts its content based on the user's wallet connection status
 * and ensures the underlying Solana program is available.
 * 
 * RENDERING LOGIC:
 * 
 * 1. Always renders within SupplyChainProgramGuard for program validation
 * 2. Shows hero section with appropriate messaging based on auth state
 * 3. For unauthenticated users: shows wallet connection button
 * 4. For authenticated users: shows full application interface
 * 
 * USER WORKFLOW:
 * 
 * 1. WALLET CONNECTION:
 *    - New users see connection prompt and program information
 *    - Clear call-to-action to connect wallet
 * 
 * 2. QR CODE SCANNING:
 *    - Mobile-first interface for scanning product QR codes
 *    - Enables quick event logging in warehouse/field environments
 * 
 * 3. PRODUCT CREATION:
 *    - Form-based interface for registering new products
 *    - Captures essential product metadata (serial number, description)
 * 
 * 4. PRODUCT MANAGEMENT:
 *    - List view of all products with status indicators
 *    - Event logging and ownership transfer capabilities
 *    - Comprehensive event history for each product
 * 
 * @returns JSX element containing the complete supply chain interface
 */
export default function SupplyChainFeature() {
  /**
   * WALLET CONNECTION STATE
   * 
   * Extract the current wallet account from the Wallet UI context.
   * This determines whether the user is authenticated and can access
   * blockchain functionality.
   * 
   * - account: null when no wallet is connected
   * - account: object with address and metadata when connected
   */
  const { account } = useWalletUi()

  return (
    /**
     * PROGRAM AVAILABILITY GUARD
     * 
     * SupplyChainProgramGuard wraps the entire interface to ensure
     * the Solana program is deployed and accessible. If the program
     * is not found, this guard will show an appropriate error message
     * instead of the main interface.
     * 
     * This prevents users from attempting operations that would fail
     * due to missing program deployment.
     */
    <SupplyChainProgramGuard>
      {/**
       * HERO SECTION
       * 
       * AppHero provides the main page header with:
       * - Application title and branding
       * - Context-aware subtitle based on authentication state
       * - Program explorer link for transparency
       * - Wallet connection button for unauthenticated users
       */}
      <AppHero
        title="Supply Chain Tracker"
        subtitle={
          account
            ? // AUTHENTICATED USER MESSAGE
              "Create products, log events, and track ownership through the supply chain. Each product is represented as an on-chain account with immutable event history."
            : // UNAUTHENTICATED USER MESSAGE
              'Connect your wallet to start tracking products in the supply chain.'
        }
      >
        {/**
         * PROGRAM EXPLORER LINK
         * 
         * Provides transparency by linking to the deployed program
         * on Solana Explorer. Users can verify the program's authenticity
         * and view transaction history.
         */}
        <p className="mb-6">
          <SupplyChainProgramExplorerLink />
        </p>
        
        {/**
         * WALLET CONNECTION PROMPT
         * 
         * Only shown to unauthenticated users. Provides a clear
         * call-to-action to connect their wallet and access the
         * application functionality.
         * 
         * The inline-block styling ensures the button is properly
         * centered within the hero section layout.
         */}
        {!account && (
          <div style={{ display: 'inline-block' }}>
            <WalletButton />
          </div>
        )}
      </AppHero>

      {/**
       * MAIN APPLICATION INTERFACE
       * 
       * Only rendered for authenticated users with connected wallets.
       * Organized into logical sections with appropriate spacing
       * and responsive design considerations.
       */}
      {account && (
        <div className="space-y-8">
          {/**
           * QR CODE SCANNING SECTION
           * 
           * MOBILE-FIRST WORKFLOW:
           * - Positioned prominently at the top for mobile users
           * - Enables quick product identification and event logging
           * - Optimized for warehouse and field operations
           * 
           * CONTAINER STYLING:
           * - max-w-md: Limits width for optimal mobile experience
           * - mx-auto: Centers the scanner on larger screens
           * 
           * USE CASES:
           * - Warehouse workers scanning products for status updates
           * - Field personnel logging shipping/receiving events
           * - Quality control inspections and audits
           */}
          <div className="max-w-md mx-auto">
            <QRScanner />
          </div>

          {/**
           * PRODUCT CREATION SECTION
           * 
           * ADMIN/OFFICE WORKFLOW:
           * - Form-based interface for product registration
           * - Captures essential metadata for new products
           * - Creates blockchain accounts for product tracking
           * 
           * CONTAINER STYLING:
           * - max-w-2xl: Wider than scanner for form fields
           * - mx-auto: Centered layout for focus
           * 
           * USE CASES:
           * - Manufacturing: Registering new products as they're created
           * - Procurement: Adding purchased items to the supply chain
           * - Inventory: Onboarding existing products to the system
           */}
          <div className="max-w-2xl mx-auto">
            <CreateProductForm />
          </div>

          {/**
           * PRODUCTS MANAGEMENT SECTION
           * 
           * COMPREHENSIVE DASHBOARD:
           * - Lists all products with status indicators
           * - Provides event logging and ownership transfer
           * - Shows complete audit trails for each product
           * 
           * LAYOUT CONSIDERATIONS:
           * - Full width for table/grid display
           * - Section header for clear navigation
           * - Accommodates growing product lists
           * 
           * FUNCTIONALITY:
           * - Product filtering and search capabilities
           * - Event history visualization
           * - Ownership transfer interfaces
           * - Status management and updates
           */}
          <div>
            {/**
             * SECTION HEADER
             * 
             * Provides clear visual separation and context
             * for the products management area.
             */}
            <h2 className="text-2xl font-semibold mb-6 text-center">
              Supply Chain Products
            </h2>
            
            {/**
             * PRODUCTS LIST COMPONENT
             * 
             * Renders the main product management interface
             * with all related functionality for viewing,
             * editing, and tracking products.
             */}
            <ProductList />
          </div>
        </div>
      )}
    </SupplyChainProgramGuard>
  )
}