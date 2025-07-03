'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { ReactQueryProvider } from './react-query-provider'
import { EnhancedSolanaProvider } from '@/components/solana/enhanced-solana-provider'
import React from 'react'

export function AppProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ReactQueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <EnhancedSolanaProvider>{children}</EnhancedSolanaProvider>
      </ThemeProvider>
    </ReactQueryProvider>
  )
}
