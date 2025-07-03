# Claude Development Notes

## IMPORTANT REMINDERS

### ⚠️ CRITICAL: TypeScript Lint Checks
- **ALWAYS** check for unused variables before committing
- **ALWAYS** avoid using `any` type - use proper TypeScript types
- **ALWAYS** import only what you use
- **ALWAYS** check for deprecated APIs (like `navigator.vendor`)

### 🔍 Pre-Commit Checklist
1. **Check for unused imports/variables**: Look for ESLint warnings
2. **Type safety**: No `any` types, use proper TypeScript interfaces
3. **Mobile compatibility**: Test on both mobile and desktop
4. **Error handling**: Ensure all async operations have proper error handling

### 🚨 Common Issues to Avoid
- Unused imports (Button, PublicKey, etc.)
- `any` types instead of proper TypeScript types
- Missing error boundaries for React components
- Deprecated browser APIs

### 🛠️ Development Commands
```bash
npm run lint          # Check for linting errors
npm run build         # Test TypeScript compilation
npm run type-check    # TypeScript type checking (if available)
```

### 📱 Mobile Wallet Integration Notes
- Uses `@solana/wallet-adapter-react` for mobile wallets
- Fallback to `@wallet-ui/react` for desktop
- Mobile detection via enhanced user agent checking
- Deep link support for Phantom, Solflare wallets (Glow removed - not operational)

### 🏗️ Architecture
```
Enhanced Provider System:
├── EnhancedSolanaProvider (auto-detects mobile/desktop)
├── MobileWalletProvider (wallet adapters)
├── WalletAdapterBridge (compatibility layer)
└── Original SolanaProvider (gill-based for desktop)
```

### 🐛 Mobile-Specific Issues Fixed
**Issue**: Client-side exception on mobile devices during app loading
**Root Cause**: SSR/hydration mismatch - accessing `window` and `navigator` objects before client-side mounting
**Fixed Files**:
- `mobile-wallet-connection.tsx`: Added `typeof window !== 'undefined'` checks for all window/navigator access
- `mobile-wallet-transaction.tsx`: Added `typeof navigator !== 'undefined'` checks  
- `mobile-wallet-ui.tsx`: Added browser environment checks, removed Glow wallet
- `enhanced-solana-provider.tsx`: Added window checks for localStorage and location access
- `client-wallet-provider.tsx`: Added browser environment checks for navigator/localStorage
- `use-is-mobile.tsx`: Added navigator existence check

**Key Learning**: Always check for browser environment before accessing DOM/Window APIs in Next.js apps
**Status**: Multiple SSR/hydration issues fixed - ready for testing

### 🔧 Mobile Debugging Tips
1. Check browser console on mobile device for client-side errors
2. Look for hydration mismatches between server and client
3. Use Chrome DevTools mobile emulation for testing
4. Test with actual mobile devices for wallet deep linking

## Last Updated
Created: 2025-01-03 (Mobile wallet integration implementation)
Updated: 2025-01-03 (Fixed mobile client-side exceptions)