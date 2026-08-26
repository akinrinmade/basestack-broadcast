'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PublicSubscribe } from '@/components/public-pages'

function ConfirmContent() {
  const searchParams = useSearchParams()
  return <PublicSubscribe mode="confirm" token={searchParams.get('token')} />
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmContent />
    </Suspense>
  )
}
