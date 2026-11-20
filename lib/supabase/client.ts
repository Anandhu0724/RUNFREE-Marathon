import { createBrowserClient } from '@supabase/ssr'

export const SUPABASE_URL = 'https://rzjwtiefidiwuurjsuxf.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eHrGcBr5y8CdrhKk-YPmpw_uLMP1AG_'

let browserClient: ReturnType<typeof createBrowserClient> | undefined
const missingConfigurationError = new Error('Supabase is not configured for this environment.')
const unavailableClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: missingConfigurationError }),
    signUp: async () => ({ data: { user: null, session: null }, error: missingConfigurationError }),
    signOut: async () => ({ error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: null, error: missingConfigurationError }) }),
      order: async () => ({ data: [], error: missingConfigurationError }),
    }),
    insert: async () => ({ error: missingConfigurationError }),
  }),
  rpc: async () => ({ data: null, error: missingConfigurationError }),
  channel: () => ({
    on: () => ({
      on: () => ({ subscribe: () => undefined }),
      subscribe: () => undefined,
    }),
    subscribe: () => undefined,
  }),
  removeChannel: async () => 'ok',
} as unknown as ReturnType<typeof createBrowserClient>

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return unavailableClient

  browserClient ??= createBrowserClient(
    url,
    key,
  )
  return browserClient
}
