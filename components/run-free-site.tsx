'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

const RunFreeMap = dynamic(() => import('@/components/run-free-map'), { ssr: false, loading: () => <div className="map-loading">Loading route map…</div> })
const departments = ['Civil Engineering', 'Mechanical Engineering', 'Electrical & Electronics Engineering', 'Electronics & Communication Engineering', 'Computer Science & Engineering', 'Other']
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG / Other']
const supabase = createClient()
type Announcement = { id: string; title: string; message: string; created_at: string }
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }
type Runner = { user_id: string; full_name: string; phone: string; is_mbc: boolean; affiliation_kind: string }


export default function RunFreeSite() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loginMode, setLoginMode] = useState(false)
  const [organizerMode, setOrganizerMode] = useState(false)
  const [isMbc, setIsMbc] = useState('')
  const [memberType, setMemberType] = useState('student')
  const [message, setMessage] = useState('')
  const [registrationResult, setRegistrationResult] = useState<'confirmed' | 'confirmation-error' | ''>('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const { mutate } = useSWRConfig()
  const { data: participantCount = 0 } = useSWR<number>('public-runner-count', async () => {
    const { data, error } = await supabase.rpc('get_runner_count')
    if (error) throw error
    return Number(data ?? 0)
  }, { refreshInterval: 30000 })
  const userId = user?.id ?? ''
  const { data: isAdmin = false } = useSWR<boolean>(userId ? ['admin', userId] : null, async () => {
    const { data, error } = await supabase.from('admin_members').select('user_id').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  })
  const { data: announcements = [] } = useSWR<Announcement[]>(userId ? ['announcements', userId] : null, async () => {
    const { data, error } = await supabase.from('event_announcements').select('id,title,message,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Announcement[]
  })
  const { data: runners = [] } = useSWR<Runner[]>(userId && isAdmin ? ['runners', userId] : null, async () => {
    const { data, error } = await supabase.from('runner_profiles').select('user_id,full_name,phone,is_mbc,affiliation_kind').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Runner[]
  }, { refreshInterval: 30000 })
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const { data: runnerProfile } = useSWR(userId ? ['profile', userId] as const : null, async () => {
    const { data, error } = await supabase.from('runner_profiles').select('full_name,runner_number,is_confirmed').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  })

  useEffect(() => {
    const registration = new URLSearchParams(window.location.search).get('registration')
    if (registration === 'confirmed' || registration === 'confirmation-error') setRegistrationResult(registration)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => { setUser(data.session?.user ?? null); if (data.session?.user) void provisionOrganizerAccess(data.session.user).catch(() => setError('Organizer access could not be verified. Please sign out and sign in again.')); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => setUser(session?.user ?? null))
    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  async function provisionOrganizerAccess(currentUser: User) {
    if (currentUser.email?.toLowerCase() !== 'ananthuk012@gmail.com') return false
    const { data, error: claimError } = await supabase.rpc('claim_run_free_admin')
    if (claimError) throw claimError
    if (data) void mutate(['admin', currentUser.id], true)
    return Boolean(data)
  }

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel('run-free-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_announcements' }, () => { void mutate(['announcements', userId]) })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'runner_profiles' }, () => { if (isAdmin) void mutate(['runners', userId]) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, isAdmin, mutate])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    try {
      if (loginMode) {
        if (organizerMode && email !== 'ananthuk012@gmail.com') throw new Error('Use the designated organizer email to sign in.')
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        setUser(data.user)
        const hasOrganizerAccess = await provisionOrganizerAccess(data.user)
        setMessage(hasOrganizerAccess ? 'Organizer access is ready. The participant list and announcement tools are available below.' : 'Welcome back. You are signed in.')
      } else {
        if (isMbc === '') throw new Error('Tell us whether you are part of MBC.')
        const phone = String(form.get('phone') ?? '').replace(/[\s-]/g, '').replace(/^\+?91/, '')
        const fullName = String(form.get('full_name') ?? '').trim()
        const affiliation = isMbc === 'yes'
        const kind = affiliation ? memberType : 'other'
        const department = affiliation ? String(form.get('department') ?? '') : ''
        const year = affiliation && kind === 'student' ? String(form.get('year') ?? '') : ''
        const place = affiliation ? '' : String(form.get('place') ?? '').trim()
        const emergency = String(form.get('emergency') ?? '').replace(/[\s-]/g, '').replace(/^\+?91/, '')
        const signature = String(form.get('signature_name') ?? '').trim()
        if (fullName.length < 2) throw new Error('Enter your full name (at least 2 characters).')
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.')
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
        if (emergency && !/^[6-9]\d{9}$/.test(emergency)) throw new Error('Enter a valid 10-digit extra contact number.')
        if (signature.length < 2) throw new Error('Type your full name as your signature.')
        if (!affiliation && !place) throw new Error('Add your place of living.')
        if (affiliation && (!department || (kind === 'student' && !year))) throw new Error('Choose your department and year of study.')
        if (form.get('agreement') !== 'on') throw new Error('Please confirm the participant declaration and agreement.')
        const { data, error: authError } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
            data: { full_name: fullName, signature_name: signature, phone, is_mbc: affiliation, affiliation_kind: kind, department, year_of_study: year, place_of_living: place, emergency_phone: emergency || '', agreement_accepted: true },
          },
        })
        if (authError) throw authError
        if (data.session) { setUser(data.user); setMessage('You are registered. Welcome to RUN FREE!') }
        else setMessage('Registration started. Check your email to confirm your account and finish signing in.')
      }
    } catch (issue) {
      const text = issue instanceof Error ? issue.message : 'Something went wrong. Please try again.'
      const normalized = text.toLowerCase()
      if (issue instanceof Error && ['AuthApiError', 'AuthRetryableFetchError'].includes(issue.name)) {
        if (normalized.includes('invalid login')) setError('Email or password is incorrect.')
        else if (normalized.includes('already registered') || normalized.includes('already been registered')) setError('Could not create an account with those details. Check your information or sign in if you already registered.')
        else if (normalized.includes('not confirmed') || normalized.includes('email_not_confirmed')) setError('Please confirm your email using the link we sent before signing in.')
        else if (normalized.includes('password') && normalized.includes('characters')) setError('Use a password with at least 8 characters.')
        else if (normalized.includes('rate limit') || normalized.includes('too many')) setError('Too many attempts. Please wait a little and try again.')
        else setError('We could not complete account setup right now. Please try again shortly.')
      } else setError(text)
    } finally { setBusy(false) }
  }

  async function publishNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    const { error: insertError } = await supabase.from('event_announcements').insert({ title: noticeTitle.trim(), message: noticeBody.trim(), created_by: userId })
    if (insertError) setError('Could not publish this update. Check the details and try again.')
    else { setNoticeTitle(''); setNoticeBody(''); setMessage('Update published to all registered runners.') }
    setBusy(false)
  }

  async function signOut() { await supabase.auth.signOut(); setUser(null); setMessage('You have signed out.') }
  const greeting = useMemo(() => runnerProfile?.full_name?.split(' ')[0] ?? 'Runner', [runnerProfile])

  return (
    <main>
      <header className="site-header">
        <a className="brand-lockup" href="#home" aria-label="Run Free home"><img className="brand-mark" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Report-facvuUvBWb6PFPFCnK8UuvV6ki03ar.png" alt="National Service Scheme emblem" /><span>NSS UNIT 180 <i>·</i> MBCCET</span></a>
        <nav aria-label="Main navigation"><a href="#home">Home</a><a href="#why">Why we run</a><a href="#route">The route</a><a href="#day">The day</a><a href="#prizes">Prizes</a><a href="#sponsor">Sponsor</a><a href="#contact">Contact</a></nav>
        <div className="header-actions">{installPrompt && <button className="install-app" type="button" onClick={installApp}>Install app <span>↓</span></button>}<a className="nav-register" href="#register">Register <span>↗</span></a></div>
      </header>

      <section className="hero" id="home">
        <video className="hero-video" autoPlay muted loop playsInline aria-hidden="true" tabIndex={-1}>
          <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/motion_video_99307356_1080p-eJtuKH0Iva9VnEZPaztxQf0AR0JhPx.mp4" type="video/mp4" />
        </video>
        <div className="hero-glow" />
        <div className="hero-lines" />
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">MAR BASELIOS CHRISTIAN COLLEGE · IN ASSOCIATION WITH TOOFAN COMMANDOS</p>
          <h1 className="hero-title"><img src="/run-free-hero-lockup.png" alt="Run Free — Marathon Against Substance Abuse" className="hero-lockup" /></h1>
          <p className="hero-tagline">One community. One route. A brighter tomorrow.</p>
          <div className="hero-actions"><a className="button button-dark" href="#register">Join the run <span>↗</span></a><a className="button button-light" href="#route">Explore the route</a></div>
          <div className="hero-stats"><div><strong>12 JAN</strong><span>2027 · 2:30 PM flag-off</span></div><div><strong>5<span className="stat-unit">KM</span></strong><span>Kuttikkanam to MBCCET</span></div><div><strong>{participantCount}</strong><span>participants joined</span></div></div>
        </div>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-wave" />
        <a className="scroll-cue" href="#why"><span /> SCROLL TO EXPLORE</a>
      </section>

      <div className="marquee" aria-label="Run free. Say no to drugs. Say yes to life."><div className="marquee-track">{Array.from({ length: 4 }, (_, i) => <span key={i}>RUN FREE <b>✳</b> SAY NO TO DRUGS <b>✳</b> SAY YES TO LIFE <b>✳</b> </span>)}</div></div>

      <section className="run-free-signoff" aria-label="Run Free">
        <img src="/run-free-band-mark.png" alt="Run Free" />
      </section>

      <section className="section why-section" id="why">
        <div className="section-kicker"><span>01</span> — WHY WE RUN</div>
        <div className="why-grid"><div className="why-copy"><h2>SAY NO TO DRUGS,<br />SAY <em>YES TO LIFE</em></h2><p>RUN FREE brings students, faculty and our community together for a 5-kilometre stand against substance abuse. Organised by NSS Unit No. 180 with Nasha Mukt Bharat Abhiyan and Toofan Commandos.</p><p className="why-signature">A run for awareness. A movement for change.</p></div><div className="impact-cards"><article className="impact-card-image"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/360_F_1846584061_F3DhSDviVw94bCi0fQwMXRmKeTKKidxe-mxz9JPqKig43ozpedqhcTb8qjPTult.jpg" alt="Young people performing an energetic community dance" /><span className="card-index">01 / MOVE</span><h3>Flashmobs</h3><p>High-energy performances that turn heads and start conversations.</p></article><article className="impact-card-image"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/dcim-drug-street-play--5--oq7PnuqX9DlmG62UiYOuX5ek2DG8u9.jpg" alt="A street theatre performance bringing a community together" /><span className="card-index">02 / SPEAK</span><h3>Nukkad Natak</h3><p>Street theatre bringing the realities of addiction into the open.</p></article><article className="impact-card-image"><img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp-Image-2026-08-12-at-8.05.12-AM-63rxjr3AismHoFuVNp7Vplm8ybx1uZ.jpeg" alt="Students holding anti-drug awareness signs at a college event" /><span className="card-index">03 / ACT</span><h3>Awareness</h3><p>Community-led action, one thoughtful step at a time.</p></article></div></div>
      </section>

      <section className="route-section" id="route"><div className="section route-layout"><div className="route-intro"><div className="section-kicker"><span>02</span> — THE ROUTE</div><div className="distance">5<span>KM</span></div><h2>KUTTIKKANAM <span>→</span><br />MBC COLLEGE</h2><p>Run 5 km from Kuttikkanam Town via Pallikunnu to MBCCET, with water at 2 km and 4 km.</p><a className="route-link" href="https://www.google.com/maps/dir/?api=1&amp;origin=Kuttikkanam+Town%2C+Kerala&amp;destination=Mar+Baselios+Christian+College+of+Engineering+and+Technology%2C+Peermade&amp;waypoints=Pallikunnu%2C+Kerala&amp;travelmode=walking" target="_blank" rel="noreferrer">Open directions in Google Maps <span>↗</span></a><p className="route-caveat">Map line is indicative. Check Google Maps for turn-by-turn directions.</p></div><RunFreeMap /></div></section>

      <section className="section day-section" id="day"><div className="section-kicker"><span>03</span> — THE DAY · 12 JANUARY 2027</div><div className="day-heading"><h2>A DAY THAT<br /><em>MOVES US.</em></h2><p>Come for the run. Leave with a reason to keep going.</p></div><div className="schedule-grid">{[
        ['1:30 PM', 'Warm-up & flashmob', 'Get moving with a flashmob before the run.'], ['2:00 PM', 'Inaugural speech', 'A motivational message from the chief guests.'], ['2:15 PM', 'Street play & pledge', 'A Nukkad Natak street play, followed by the anti-drug pledge.'], ['2:30 PM', 'Flag-off · 5 km run', 'The run starts from Kuttikkanam Town, with refreshment points at 2 km and 4 km.'], ['4:00 PM', 'Rest & refreshments', 'Post-run rest and refreshments.'], ['4:15 PM', 'Felicitation', 'Felicitation of the winners.'],
      ].map(([time, title, detail], index) => <details className={`schedule-item ${index === 3 ? 'schedule-featured' : ''}`} key={time} open={index === 3}><summary><span>{time}</span><b>{title}</b><i>+</i></summary><p>{detail}</p></details>)}</div></section>

      <section className="prize-section" id="prizes"><div className="section"><div className="section-kicker"><span>04</span> — PRIZES & FINISHER REWARDS</div><div className="prize-heading"><h2>RUN IT.<br /><em>FINISH IT.</em><br />REMEMBER IT.</h2><p>Complete all 5 km within the official event time limit to earn your finisher rewards.</p></div><div className="prize-cards"><article className="prize-card prize-pool"><span>01 — PRIZE POOL</span><strong>₹3,000</strong><h3>Total prize pool</h3><p>For the RUN FREE 2027 marathon.</p></article><article className="prize-card"><span>02 — FINISHER REWARD</span><h3>Completion medal</h3><p>Earn your medal by completing the 5 km within the official time limit.</p></article><article className="prize-card"><span>03 — FINISHER REWARD</span><h3>Completion certificate</h3><p>Receive a certificate when you finish the 5 km within the official time limit.</p></article></div></div></section>

      <section className="pledge-band"><div className="pledge-mark">“</div><p>Every step we run today is a stride toward a brighter, drug-free tomorrow. <em>Let us unite, run with purpose, and create change.</em></p><span>— THE RUN FREE PLEDGE</span></section>

      <section className="register-section" id="register"><div className="section register-layout"><div className="register-intro"><div className="section-kicker"><span>05</span> — JOIN THE RUN</div><h2>YOUR NEXT<br />STEP STARTS<br /><em>HERE.</em></h2><p>Register to run with us. Create your account to receive event updates from the organisers.</p><div className="register-note"><span className="note-mark">i</span><span>Your information is used to manage your event registration. Your account lets you read organiser announcements.</span></div></div>
        <div className="form-card">
          {registrationResult === 'confirmed' && <p className="form-message" role="status">{runnerProfile?.is_confirmed && runnerProfile.runner_number ? <>Email confirmed — your slot is booked. Your participant number is <b className="participant-number">RF{String(runnerProfile.runner_number).padStart(3, '0')}</b>.</> : 'Email confirmed. Your slot number will appear here shortly.'}</p>}
          {registrationResult === 'confirmation-error' && <p className="form-error" role="alert">That confirmation link could not be used. It may have expired; request a new email or sign in again.</p>}
          {!authReady ? <div className="loading-copy">Getting things ready…</div> : user ? <>
            <div className="signed-in-top"><div><div className="section-kicker"><span>WELCOME</span> — RUNNER ACCOUNT</div><h3>Hey, {greeting}.</h3></div><button type="button" className="text-button" onClick={signOut}>Sign out</button></div>
            <div className="account-status"><span className="status-check">✓</span><div><strong>{isAdmin ? 'Organizer access is active.' : runnerProfile?.is_confirmed || registrationResult === 'confirmed' ? 'Your RUN FREE slot is booked.' : 'Confirm your email to book your slot.'}</strong><p>Signed in as {user.email}. {runnerProfile?.runner_number ? <>Your participant number is <b className="participant-number">RF{String(runnerProfile.runner_number).padStart(3, '0')}</b>. </> : isAdmin ? 'This account is not counted as a participant. ' : 'Your participant number is loading. ' }Organiser updates will appear here live.</p></div></div>
            {message && <p className="form-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
            <div className="updates-heading"><span className="live-dot" /> NOTIFICATIONS <span className="updates-count">{announcements.length} {announcements.length === 1 ? 'UPDATE' : 'UPDATES'}</span><span className="updates-live">LIVE</span></div>
            {announcements.length ? <div className="announcement-list">{(announcements as Announcement[]).map((notice) => <article className="announcement" key={notice.id}><div className="announcement-date">{new Date(notice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div><h4>{notice.title}</h4><p>{notice.message}</p></article>)}</div> : <div className="empty-updates">No updates yet. Check back here for announcements from the organisers.</div>}
            {isAdmin && <div className="admin-panel"><div className="admin-heading"><div><span className="section-kicker">ADMIN DESK</span><h3>Runner monitor</h3></div><span className="admin-count">{(runners as Runner[]).length} registered</span></div><a className="organizer-desk-link" href="/organizer">Open full organizer desk <span>↗</span></a><div className="runner-table-wrap"><table className="runner-table"><thead><tr><th>Participant name</th><th>Phone number</th><th>Category</th></tr></thead><tbody>{(runners as Runner[]).map((runner) => <tr key={runner.user_id}><td>{runner.full_name}</td><td>{runner.phone}</td><td>{runner.is_mbc ? runner.affiliation_kind === 'faculty' ? 'MBC faculty' : 'MBC student' : 'Outsider'}</td></tr>)}</tbody></table></div><form className="notice-form" onSubmit={publishNotice}><label>Post an update<input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} maxLength={120} required placeholder="Update title" /></label><label>Message<textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} maxLength={2000} required rows={3} placeholder="Write an update for registered runners…" /></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'} <span>↗</span></button></form></div>}
          </> : <>
            <div className="form-card-head"><div className="step-mark">RUN FREE <span>/ {organizerMode ? 'ORGANIZER ACCESS' : 'RUNNER REGISTRATION'}</span></div><h3>{organizerMode ? 'Organizer sign in.' : loginMode ? 'Welcome back.' : 'Join the starting line.'}</h3><p>{organizerMode ? 'Sign in with the designated organizer account to open the admin desk.' : loginMode ? 'Sign in to see your registration and event updates.' : 'Tell us a little about yourself to register.'}</p></div>
            <form className="registration-form" onSubmit={handleAuth}>
              {!loginMode && !organizerMode && <>
                <label>Full name<input name="full_name" type="text" autoComplete="name" minLength={2} maxLength={80} placeholder="Your full name" required /></label>
              </>}
              <label>Email address<input name="email" type="email" autoComplete="email" defaultValue={organizerMode ? 'ananthuk012@gmail.com' : undefined} readOnly={organizerMode} placeholder="you@example.com" required /></label>
              {!loginMode && !organizerMode && <label>Mobile number<input name="phone" type="tel" autoComplete="tel" placeholder="10-digit mobile number" required /></label>}
              <label>Password<input name="password" type="password" autoComplete={loginMode ? 'current-password' : 'new-password'} minLength={loginMode ? undefined : 8} placeholder={loginMode ? 'Your password' : 'At least 8 characters'} required /></label>
              {!loginMode && !organizerMode && <>
                <fieldset className="choice-field"><legend>Are you part of MBC?</legend><div className="choice-row"><button type="button" className={isMbc === 'yes' ? 'choice selected' : 'choice'} onClick={() => setIsMbc('yes')}>Yes, I am</button><button type="button" className={isMbc === 'no' ? 'choice selected' : 'choice'} onClick={() => setIsMbc('no')}>No, I’m a guest</button></div></fieldset>
                {isMbc === 'yes' && <div className="field-grid"><label>I am a<select value={memberType} onChange={(event) => setMemberType(event.target.value)}><option value="student">Student</option><option value="faculty">Faculty</option></select></label><label>Department<select name="department" required><option value="">Choose department</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>{memberType === 'student' && <label>Year of study<select name="year" required><option value="">Choose year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>}</div>}
                {isMbc === 'no' && <label>Place of living<input name="place" type="text" maxLength={160} placeholder="Town / locality" required /></label>}
                <label>Extra contact number <span className="optional">OPTIONAL</span><input name="emergency" type="tel" placeholder="A number we can call if needed" /></label>
                <label className="agreement"><input name="agreement" type="checkbox" required /><span>I am medically fit and choose to participate voluntarily. I understand the risks of fatigue, dehydration, falls, injury, heat and traffic, will follow organisers’ and medical staff instructions, and may be stopped if unwell. I consent to emergency first aid and medical treatment. To the extent permitted by law, I release MBCCET, NSS Unit 180, Toofan Commandos, Nasha Mukt Bharat Abhiyan and volunteers from liability for loss or injury arising from my participation. I consent to event photos/videos for awareness and publicity, confirm I am 18+ or have parent/guardian consent, and agree my data is used to manage this event.</span></label>
                <label>Type your full name as your signature<input name="signature_name" type="text" minLength={2} maxLength={80} placeholder="Your full name" required /></label>
              </>}
              {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
              <button className="button button-dark form-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : organizerMode ? 'Sign in to admin desk' : loginMode ? 'Sign in' : 'Create my account'} <span>↗</span></button>
            </form>
            <p className="form-switch">{organizerMode ? <button type="button" onClick={() => { setOrganizerMode(false); setLoginMode(false); setError(''); setMessage('') }}>Participant registration</button> : <>{loginMode ? 'New to the run?' : 'Already registered?'} <button type="button" onClick={() => { setLoginMode(!loginMode); setError(''); setMessage('') }}>{loginMode ? 'Create an account' : 'Sign in'}</button>{' · '}<button type="button" onClick={() => { setOrganizerMode(true); setLoginMode(true); setError(''); setMessage('') }}>Organizer access</button></>}</p>
          </>}
        </div>
      </div></section>

      <section className="sponsor-section" id="sponsor"><div className="section sponsor-layout"><div><div className="section-kicker"><span>06</span> — PARTNER WITH PURPOSE</div><h2>FUEL THE<br/><em>CHANGE.</em></h2><p>We welcome financial sponsorship and in-kind support—from refreshments and medical kits to printing, media coverage and volunteer time. Every contribution helps build a stronger, addiction-free community.</p></div><div className="sponsor-contact"><span className="sponsor-label">SPONSORSHIP &amp; SUPPORT</span><h3>Prof. Baiju George</h3><p>NSS Programming Officer · Unit No. 180</p><a href="tel:+919778521538">+91 97785 21538</a><a href="mailto:baijugeorge@mbcpeermade.com?subject=RUN%20FREE%20Sponsorship%20Enquiry">baijugeorge@mbcpeermade.com</a><p className="sponsor-address">Mar Baselios Christian College of Engineering &amp; Technology, Peermade, Kuttikkanam, Idukki, 685531.</p><a className="button button-lime" href="mailto:baijugeorge@mbcpeermade.com?subject=RUN%20FREE%20Sponsorship%20Enquiry">Discuss sponsorship <span>↗</span></a></div></div></section>

      <section className="contact-section" id="contact"><div className="contact-card"><div className="section-kicker">QUESTIONS ABOUT THE RUN?</div><h2>LET’S TALK.</h2><a href="tel:+919994420724" className="contact-phone">+91 99944 20724</a><div className="contact-actions"><a className="button button-lime" href="tel:+919994420724">Call us <span>↗</span></a><a className="button button-light" href="https://wa.me/919994420724" target="_blank" rel="noreferrer">WhatsApp</a></div></div></section>

      <footer className="site-footer"><div className="footer-top"><div><a className="footer-logo" href="#home">RUN FREE<span> / 2027</span></a><p>Against Substance Abuse.<br />A community run by NSS Unit No. 180, MBCCET.</p><p className="footer-address">Mar Baselios Christian College of Engineering & Technology, Peermade, Kuttikkanam, Idukki, 685531.</p></div><div className="footer-links"><span className="footer-label">EXPLORE</span><a href="#why">Why we run</a><a href="#route">The route</a><a href="#day">The day</a><a href="#register">Register</a><a href="/organizer">Organizer desk</a></div><div className="footer-social"><span className="footer-label">FOLLOW ALONG</span><a href="https://www.instagram.com/nss_mbc" target="_blank" rel="noopener noreferrer">@nss_mbc <span>↗</span></a><p>Organised with Toofan Commandos & Nasha Mukt Bharat Abhiyan.</p><details className="privacy-details"><summary>Privacy &amp; data use</summary><p>Your name, contact details and affiliation are collected to manage event registration and organiser updates. Registration records are visible only to authorised organisers and you. Email is handled by Supabase Auth. Map tiles may be served by OpenStreetMap or Esri; directions open Google Maps. Contact the organisers to request access or correction.</p></details></div></div><div className="footer-bottom"><span>© 2027 NSS Unit No. 180 · MBCCET</span><span>Run for a cause. Say NO to drugs. Say YES to life.</span><a href="#home">BACK TO TOP ↑</a></div></footer>
    </main>
  )
}
