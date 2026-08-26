import { PublicSubscribe } from '@/components/broadcast-console'

export default function UnsubscribePage() {
  return <PublicSubscribe mode="unsubscribe" />
}

export const metadata = { title: 'Unsubscribe · Basestack Academy' }
