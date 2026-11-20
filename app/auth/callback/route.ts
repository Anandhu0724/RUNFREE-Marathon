import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/supabase/client'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const cookieStore = await cookies()

  let registration = 'confirmation-error'

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      },
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) registration = 'confirmed'
  }

  const destination = new URL('/', url.origin)
  destination.searchParams.set('registration', registration)
  destination.hash = 'register'
  return NextResponse.redirect(destination)
}
