import { supabase } from '@/lib/supabase/client'

/** Fetches a same-origin API route with the current Supabase session attached as a Bearer token. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}

export async function authFetchJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(input, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`)
  }
  return data as T
}
