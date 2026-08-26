'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PublicSubscribe } from '@/components/public-pages'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  return <PublicSubscribe mode="unsubscribe" token={searchParams.get('token')} />
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  )
}
