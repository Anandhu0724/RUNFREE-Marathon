'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Announcement = { id: string; title: string; message: string; created_at: string }
type Runner = {
  user_id: string
  full_name: string
  phone: string
  is_mbc: boolean
  affiliation_kind: string
}

const organizerEmail = 'ananthuk012@gmail.com'
const supabase = createClient()

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OrganizerDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const { mutate } = useSWRConfig()
  const userId = user?.id ?? ''
  const { data: isAdmin, error: accessError, isLoading: accessLoading } = useSWR<boolean>(userId ? ['organizer-access', userId] : null, async () => {
    const { data, error: queryError } = await supabase.from('admin_members').select('user_id').eq('user_id', userId).maybeSingle()
    if (queryError) throw queryError
    return Boolean(data)
  })
  const { data: announcements = [], error: announcementsError, mutate: refreshAnnouncements } = useSWR<Announcement[]>(userId && isAdmin ? ['organizer-announcements', userId] : null, async () => {
    const { data, error: queryError } = await supabase.from('event_announcements').select('id,title,message,created_at').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return (data ?? []) as Announcement[]
  }, { refreshInterval: 30000 })
  const { data: runners = [], error: runnersError, mutate: refreshRunners } = useSWR<Runner[]>(userId && isAdmin ? ['organizer-runners', userId] : null, async () => {
    const { data, error: queryError } = await supabase.from('runner_profiles').select('user_id,full_name,phone,is_mbc,affiliation_kind').order('created_at', { ascending: false })
    if (queryError) throw queryError
    return (data ?? []) as Runner[]
  }, { refreshInterval: 30000 })

  async function claimOrganizerAccess(currentUser: User) {
    if (currentUser.email?.toLowerCase() !== organizerEmail) return false
    const { data, error: claimError } = await supabase.rpc('claim_run_free_admin')
    if (claimError) throw claimError
    return Boolean(data)
  }

  useEffect(() => {
    let active = true
    const initialize = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError) setError('Could not check your session. Please reload and try again.')
      const currentUser = data.session?.user ?? null
      if (currentUser) {
        try {
          if (currentUser.email?.toLowerCase() === organizerEmail) {
            const hasAccess = await claimOrganizerAccess(currentUser)
            if (active && hasAccess) await mutate(['organizer-access', currentUser.id], true)
          }
        } catch {
          if (active) setError('Organizer access could not be verified. Please sign in again.')
        }
        if (active) setUser(currentUser)
      }
      if (active) setAuthReady(true)
    }
    void initialize()
    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (active) setUser(session?.user ?? null)
    })
    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [mutate])

  useEffect(() => {
    if (!userId || !isAdmin) return
    const channel = supabase.channel(`organizer-desk-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_announcements' }, () => { void refreshAnnouncements() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'runner_profiles' }, () => { void refreshRunners() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, isAdmin, refreshAnnouncements, refreshRunners])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: organizerEmail, password })
      if (authError || !data.user) throw authError ?? new Error('Missing user')
      const hasAccess = await claimOrganizerAccess(data.user)
      if (!hasAccess) {
        await supabase.auth.signOut()
        throw new Error('Could not verify organizer access.')
      }
      setUser(data.user)
      await mutate(['organizer-access', data.user.id], true)
      setMessage('Organizer access verified.')
    } catch (issue) {
      const text = issue instanceof Error ? issue.message.toLowerCase() : ''
      if (text.includes('rate limit') || text.includes('too many')) setError('Too many attempts. Please wait a little before trying again.')
      else setError('Could not verify organizer access. Check the sign-in details or contact an event administrator.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setMessage('You have signed out.')
    setError('')
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    const title = noticeTitle.trim()
    const body = noticeBody.trim()
    if (!title || !body) {
      setError('Add a title and message before publishing.')
      return
    }
    if (!userId || !isAdmin) {
      setError('Your organizer session is no longer active. Sign in again.')
      return
    }
    setBusy(true)
    const { error: insertError } = await supabase.from('event_announcements').insert({ title, message: body, created_by: userId })
    if (insertError) setError('Could not publish this update. Please try again.')
    else {
      setNoticeTitle('')
      setNoticeBody('')
      setMessage('Update published to registered runners.')
      await refreshAnnouncements()
    }
    setBusy(false)
  }

  const signedInAsOrganizer = Boolean(user && isAdmin)

  return (
    <main className="organizer-page">
      <header className="organizer-topbar">
        <Link className="organizer-brand" href="/" aria-label="RUN FREE home">RUN FREE <span>/ ORGANIZER DESK</span></Link>
        <div className="organizer-top-actions">
          <Link href="/" className="organizer-home-link">Back to event</Link>
          {signedInAsOrganizer && <button className="organizer-signout" type="button" onClick={signOut}>Sign out</button>}
        </div>
      </header>

      <div className="organizer-content">
        {!authReady ? (
          <section className="organizer-login-card" aria-live="polite"><p className="organizer-kicker">ADMIN DESK</p><h1>Checking organizer access…</h1></section>
        ) : !user ? (
          <section className="organizer-login-card">
            <p className="organizer-kicker">RUN FREE / PRIVATE ACCESS</p>
            <h1>Organizer sign in.</h1>
            <p className="organizer-lede">Use the designated event organizer account to manage announcements and registrations.</p>
            <div className="organizer-email"><span>Organizer email</span><strong>{organizerEmail}</strong></div>
            <form className="organizer-login-form" onSubmit={signIn}>
              <label htmlFor="organizer-password">Password</label>
              <input id="organizer-password" name="password" type="password" autoComplete="current-password" minLength={8} placeholder="Enter your password" required />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Verifying access…' : 'Sign in to organizer desk'} <span>↗</span></button>
            </form>
            <p className="organizer-login-footnote">Organizer accounts are provisioned separately. This page does not create accounts.</p>
            <Link className="organizer-back-link" href="/">Return to RUN FREE</Link>
          </section>
        ) : accessLoading ? (
          <section className="organizer-login-card" aria-live="polite"><p className="organizer-kicker">ADMIN DESK</p><h1>Verifying your access…</h1></section>
        ) : accessError || !isAdmin ? (
          <section className="organizer-login-card" role="alert">
            <p className="organizer-kicker">PRIVATE ACCESS</p>
            <h1>Organizer access required.</h1>
            <p className="organizer-lede">This account is not authorized to view participant records or publish event updates.</p>
            <button className="button button-dark" type="button" onClick={signOut}>Sign out</button>
          </section>
        ) : (
          <>
            <section className="organizer-heading">
              <div>
                <p className="organizer-kicker">RUN FREE / 2027 EVENT OPERATIONS</p>
                <h1>Organizer desk.</h1>
                <p className="organizer-lede">Manage runner registrations and share important event updates.</p>
              </div>
              <button className="organizer-refresh" type="button" onClick={() => { void refreshRunners(); void refreshAnnouncements() }}>Refresh data</button>
            </section>

            {(error || message) && <p className={error ? 'organizer-alert is-error' : 'organizer-alert'} role={error ? 'alert' : 'status'}>{error || message}</p>}

            <section className="organizer-stats" aria-label="Event overview">
              <article className="organizer-stat"><span>TOTAL REGISTRATIONS</span><strong>{runners.length}</strong><small>All submitted sign-ups</small></article>
              <article className="organizer-stat"><span>EVENT UPDATES</span><strong>{announcements.length}</strong><small>Visible to signed-in runners</small></article>
              <article className="organizer-stat organizer-stat-accent"><span>ACCOUNT</span><strong>ACTIVE</strong><small>{user.email}</small></article>
            </section>

            <div className="organizer-grid">
              <section className="organizer-card organizer-roster">
                <div className="organizer-card-heading">
                  <div><p className="organizer-kicker">REGISTRATIONS</p><h2>Runner roster</h2></div>
                  <span className="organizer-count">{runners.length} registered</span>
                </div>
                {runnersError ? <p className="organizer-inline-error" role="alert">Runner records could not be loaded. Try refreshing.</p> : runners.length ? (
                  <div className="organizer-table-scroll" role="region" aria-label="Participant registrations" tabIndex={0}>
                    <table className="organizer-table">
                      <caption className="sr-only">RUN FREE participant names, phone numbers, and categories</caption>
                      <thead><tr><th scope="col">Participant name</th><th scope="col">Phone number</th><th scope="col">Category</th></tr></thead>
                      <tbody>{runners.map((runner) => <tr key={runner.user_id}>
                        <td>{runner.full_name}</td><td>{runner.phone}</td>
                        <td>{runner.is_mbc ? runner.affiliation_kind === 'faculty' ? 'MBC faculty' : 'MBC student' : 'Outsider'}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                ) : <div className="organizer-empty">No registrations yet. New sign-ups will appear here automatically.</div>}
                <p className="organizer-private-note">Registration details are visible only to authorized organizers.</p>
              </section>

              <aside className="organizer-side-column">
                <section className="organizer-card">
                  <div className="organizer-card-heading"><div><p className="organizer-kicker">COMMUNICATIONS</p><h2>Post an update</h2></div></div>
                  <p className="organizer-card-copy">Updates are shared with registered runners in the event page.</p>
                  <form className="organizer-notice-form" onSubmit={publishAnnouncement}>
                    <label htmlFor="notice-title">Title</label>
                    <input id="notice-title" value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} maxLength={120} placeholder="Update title" required />
                    <label htmlFor="notice-message">Message</label>
                    <textarea id="notice-message" value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} maxLength={2000} rows={5} placeholder="Write an update for registered runners…" required />
                    <div className="organizer-form-footer"><span>{noticeBody.length}/2000</span><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'} <span>↗</span></button></div>
                  </form>
                </section>

                <section className="organizer-card organizer-updates-card">
                  <div className="organizer-card-heading"><div><p className="organizer-kicker">RECENT MESSAGES</p><h2>Announcements</h2></div></div>
                  {announcementsError ? <p className="organizer-inline-error" role="alert">Announcements could not be loaded. Try refreshing.</p> : announcements.length ? (
                    <div className="organizer-announcements">{announcements.map((notice) => <article className="organizer-announcement" key={notice.id}><time dateTime={notice.created_at}>{formatDate(notice.created_at)}</time><h3>{notice.title}</h3><p>{notice.message}</p></article>)}</div>
                  ) : <div className="organizer-empty">No announcements yet. Publish an update to share it with runners.</div>}
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
