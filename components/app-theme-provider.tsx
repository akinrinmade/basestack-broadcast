'use client'

import { useEffect } from 'react'

export type AppTheme = 'studio' | 'paper' | 'mint' | 'coral'

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stored = window.localStorage.getItem('basestack-app-theme') as AppTheme | null
    document.documentElement.dataset.appTheme = stored || 'studio'
  }, [])

  return children
}

export function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.appTheme = theme
  window.localStorage.setItem('basestack-app-theme', theme)
}
