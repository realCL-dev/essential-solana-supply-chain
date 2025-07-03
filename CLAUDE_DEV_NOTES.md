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
- Deep link support for Phantom, Solflare, Glow wallets

### 🏗️ Architecture
```
Enhanced Provider System:
├── EnhancedSolanaProvider (auto-detects mobile/desktop)
├── MobileWalletProvider (wallet adapters)
├── WalletAdapterBridge (compatibility layer)
└── Original SolanaProvider (gill-based for desktop)
```

## Last Updated
Created: 2025-01-03 (Mobile wallet integration implementation)