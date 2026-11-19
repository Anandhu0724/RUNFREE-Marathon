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
type Runner = { user_id: string; full_name: string; email: string; phone: string; is_mbc: boolean; affiliation_kind: string; department: string | null; year_of_study: string | null; created_at: string }


export default function RunFreeSite() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loginMode, setLoginMode] = useState(false)
  const [isMbc, setIsMbc] = useState('')
  const [memberType, setMemberType] = useState('student')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { mutate } = useSWRConfig()
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
    const { data, error } = await supabase.from('runner_profiles').select('user_id,full_name,email,phone,is_mbc,affiliation_kind,department,year_of_study,created_at').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as Runner[]
  })
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const { data: runnerProfile } = useSWR(userId ? ['profile', userId] as const : null, async () => {
    const { data } = await supabase.from('runner_profiles').select('full_name').eq('user_id', userId).maybeSingle()
    return data
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => { setUser(data.session?.user ?? null); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

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
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        setUser(data.user); setMessage('Welcome back. You are signed in.')
      } else {
        if (isMbc === '') throw new Error('Tell us whether you are part of MBC.')
        const phone = String(form.get('phone') ?? '').replace(/[\\s-]/g, '').replace(/^\\+?91/, '')
        const fullName = String(form.get('full_name') ?? '').trim()
        const affiliation = isMbc === 'yes'
        const kind = affiliation ? memberType : 'other'
        const department = affiliation ? String(form.get('department') ?? '') : ''
        const year = affiliation && kind === 'student' ? String(form.get('year') ?? '') : ''
        const place = affiliation ? '' : String(form.get('place') ?? '').trim()
        const emergency = String(form.get('emergency') ?? '').replace(/[\\s-]/g, '').replace(/^\\+?91/, '')
        const signature = String(form.get('signature_name') ?? '').trim()
        if (fullName.length < 2) throw new Error('Enter your full name (at least 2 characters).')
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.')
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
        if (emergency && !/^[6-9]\\d{9}$/.test(emergency)) throw new Error('Enter a valid 10-digit extra contact number.')
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
        <a className="brand-lockup" href="#home" aria-label="Run Free home"><span className="brand-mark">RF</span><span>NSS UNIT 180 <i>·</i> MBCCET</span></a>
        <nav aria-label="Main navigation"><a href="#home">Home</a><a href="#why">Why we run</a><a href="#route">The route</a><a href="#day">The day</a><a href="#contact">Contact</a></nav>
        <a className="nav-register" href="#register">Register <span>↗</span></a>
      </header>

      <section className="hero" id="home">
        <div className="hero-glow" />
        <div className="hero-lines" />
        <div className="hero-content">
          <p className="eyebrow hero-eyebrow">MAR BASELIOS CHRISTIAN COLLEGE · IN ASSOCIATION WITH TOOFAN COMMANDOS</p>
          <h1>RUN <span>FREE</span></h1>
          <p className="hero-subtitle">AGAINST SUBSTANCE ABUSE</p>
          <p className="hero-tagline">One community. One route. A brighter tomorrow.</p>
          <div className="hero-actions"><a className="button button-dark" href="#register">Join the run <span>↗</span></a><a className="button button-light" href="#route">Explore the route</a></div>
          <div className="hero-stats"><div><strong>12 JAN</strong><span>2027 · 2:30 PM flag-off</span></div><div><strong>5<span className="stat-unit">KM</span></strong><span>Kuttikkanam to MBCCET</span></div><div><strong>ONE</strong><span>step toward a drug-free life</span></div></div>
        </div>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-wave" />
        <a className="scroll-cue" href="#why"><span /> SCROLL TO EXPLORE</a>
      </section>

      <div className="marquee" aria-label="Run free. Say no to drugs. Say yes to life."><div className="marquee-track">{Array.from({ length: 4 }, (_, i) => <span key={i}>RUN FREE <b>✳</b> SAY NO TO DRUGS <b>✳</b> SAY YES TO LIFE <b>✳</b> </span>)}</div></div>

      <section className="section why-section" id="why">
        <div className="section-kicker"><span>01</span> — WHY WE RUN</div>
        <div className="why-grid"><div className="why-copy"><h2>SAY NO TO DRUGS,<br />SAY <em>YES TO LIFE</em></h2><p>RUN FREE brings students, faculty and our community together for a 5-kilometre stand against substance abuse. Organised by NSS Unit No. 180 with Nasha Mukt Bharat Abhiyan and Toofan Commandos.</p><p className="why-signature">A run for awareness. A movement for change.</p></div><div className="impact-cards"><article><span className="card-index">01 / MOVE</span><div className="impact-icon">↗</div><h3>Flashmobs</h3><p>High-energy performances that turn heads and start conversations.</p></article><article><span className="card-index">02 / SPEAK</span><div className="impact-icon">✳</div><h3>Nukkad Natak</h3><p>Street theatre bringing the realities of addiction into the open.</p></article><article><span className="card-index">03 / ACT</span><div className="impact-icon">◎</div><h3>Awareness</h3><p>Community-led action, one thoughtful step at a time.</p></article></div></div>
      </section>

      <section className="route-section" id="route"><div className="section route-layout"><div className="route-intro"><div className="section-kicker"><span>02</span> — THE ROUTE</div><div className="distance">5<span>KM</span></div><h2>KUTTIKKANAM <span>→</span><br />MBC COLLEGE</h2><p>A 5 km community run with refreshment points at every 2 km.</p><a className="route-link" href="https://www.google.com/maps/dir/Kuttikkanam+Town/Mar+Baselios+Christian+College+of+Engineering+and+Technology,+Peermade" target="_blank" rel="noreferrer">Open directions in Google Maps <span>↗</span></a><p className="route-caveat">Map line is indicative. Check Google Maps for turn-by-turn directions.</p></div><RunFreeMap /></div></section>

      <section className="section day-section" id="day"><div className="section-kicker"><span>03</span> — THE DAY · 12 JANUARY 2027</div><div className="day-heading"><h2>A DAY THAT<br /><em>MOVES US.</em></h2><p>Come for the run. Leave with a reason to keep going.</p></div><div className="schedule-grid">{[
        ['1:30 PM', 'Warm-up & flashmob', 'Get moving with a flashmob before the run.'], ['2:00 PM', 'Inaugural speech', 'A motivational message from the chief guests.'], ['2:15 PM', 'Street play & pledge', 'A Nukkad Natak street play, followed by the anti-drug pledge.'], ['2:30 PM', 'Flag-off · 5 km run', 'The run starts from Kuttikkanam Town, with refreshment points at 2 km and 4 km.'], ['4:00 PM', 'Rest & refreshments', 'Post-run rest and refreshments.'], ['4:15 PM', 'Felicitation', 'Felicitation of the winners.'],
      ].map(([time, title, detail], index) => <details className={`schedule-item ${index === 3 ? 'schedule-featured' : ''}`} key={time} open={index === 3}><summary><span>{time}</span><b>{title}</b><i>+</i></summary><p>{detail}</p></details>)}</div></section>

      <section className="pledge-band"><div className="pledge-mark">“</div><p>Every step we run today is a stride toward a brighter, drug-free tomorrow. <em>Let us unite, run with purpose, and create change.</em></p><span>— THE RUN FREE PLEDGE</span></section>

      <section className="register-section" id="register"><div className="section register-layout"><div className="register-intro"><div className="section-kicker"><span>04</span> — JOIN THE RUN</div><h2>YOUR NEXT<br />STEP STARTS<br /><em>HERE.</em></h2><p>Register to run with us. Create your account to receive event updates from the organisers.</p><div className="register-note"><span className="note-mark">i</span><span>Your information is used to manage your event registration. Your account lets you read organiser announcements.</span></div></div>
        <div className="form-card">
          {!authReady ? <div className="loading-copy">Getting things ready…</div> : user ? <>
            <div className="signed-in-top"><div><div className="section-kicker"><span>WELCOME</span> — RUNNER ACCOUNT</div><h3>Hey, {greeting}.</h3></div><button type="button" className="text-button" onClick={signOut}>Sign out</button></div>
            <div className="account-status"><span className="status-check">✓</span><div><strong>You’re on the list.</strong><p>Signed in as {user.email}. Organiser updates will appear here live.</p></div></div>
            {message && <p className="form-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
            <div className="updates-heading"><span className="live-dot" /> ORGANISER UPDATES <span className="updates-live">LIVE</span></div>
            {announcements.length ? <div className="announcement-list">{(announcements as Announcement[]).map((notice) => <article className="announcement" key={notice.id}><div className="announcement-date">{new Date(notice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div><h4>{notice.title}</h4><p>{notice.message}</p></article>)}</div> : <div className="empty-updates">No updates yet. Check back here for announcements from the organisers.</div>}
            {isAdmin && <div className="admin-panel"><div className="admin-heading"><div><span className="section-kicker">ADMIN DESK</span><h3>Runner monitor</h3></div><span className="admin-count">{(runners as Runner[]).length} registered</span></div><div className="runner-table-wrap"><table className="runner-table"><thead><tr><th>Runner</th><th>Email</th><th>Phone</th><th>Affiliation</th><th>Registered</th></tr></thead><tbody>{(runners as Runner[]).map((runner) => <tr key={runner.user_id}><td>{runner.full_name}</td><td>{runner.email}</td><td>{runner.phone}</td><td>{runner.is_mbc ? `${runner.affiliation_kind}${runner.department ? ` · ${runner.department}` : ''}${runner.year_of_study ? ` · ${runner.year_of_study}` : ''}` : 'Community'}</td><td>{new Date(runner.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div><form className="notice-form" onSubmit={publishNotice}><label>Post an update<input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} maxLength={120} required placeholder="Update title" /></label><label>Message<textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} maxLength={2000} required rows={3} placeholder="Write an update for registered runners…" /></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish update'} <span>↗</span></button></form></div>}
          </> : <>
            <div className="form-card-head"><div className="step-mark">RUN FREE <span>/ RUNNER REGISTRATION</span></div><h3>{loginMode ? 'Welcome back.' : 'Join the starting line.'}</h3><p>{loginMode ? 'Sign in to see your registration and event updates.' : 'Tell us a little about yourself to register.'}</p></div>
            <form className="registration-form" onSubmit={handleAuth}>
              {!loginMode && <>
                <label>Full name<input name="full_name" type="text" autoComplete="name" minLength={2} maxLength={80} placeholder="Your full name" required /></label>
              </>}
              <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
              {!loginMode && <label>Mobile number<input name="phone" type="tel" autoComplete="tel" placeholder="10-digit mobile number" required /></label>}
              <label>Password<input name="password" type="password" autoComplete={loginMode ? 'current-password' : 'new-password'} minLength={8} placeholder="At least 8 characters" required /></label>
              {!loginMode && <>
                <fieldset className="choice-field"><legend>Are you part of MBC?</legend><div className="choice-row"><button type="button" className={isMbc === 'yes' ? 'choice selected' : 'choice'} onClick={() => setIsMbc('yes')}>Yes, I am</button><button type="button" className={isMbc === 'no' ? 'choice selected' : 'choice'} onClick={() => setIsMbc('no')}>No, I’m a guest</button></div></fieldset>
                {isMbc === 'yes' && <div className="field-grid"><label>I am a<select value={memberType} onChange={(event) => setMemberType(event.target.value)}><option value="student">Student</option><option value="faculty">Faculty</option></select></label><label>Department<select name="department" required><option value="">Choose department</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label>{memberType === 'student' && <label>Year of study<select name="year" required><option value="">Choose year</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>}</div>}
                {isMbc === 'no' && <label>Place of living<input name="place" type="text" maxLength={160} placeholder="Town / locality" required /></label>}
                <label>Extra contact number <span className="optional">OPTIONAL</span><input name="emergency" type="tel" placeholder="A number we can call if needed" /></label>
                <label className="agreement"><input name="agreement" type="checkbox" required /><span>I am medically fit and choose to participate voluntarily. I understand the risks of fatigue, dehydration, falls, injury, heat and traffic, will follow organisers’ and medical staff instructions, and may be stopped if unwell. I consent to emergency first aid and medical treatment. To the extent permitted by law, I release MBCCET, NSS Unit 180, Toofan Commandos, Nasha Mukt Bharat Abhiyan and volunteers from liability for loss or injury arising from my participation. I consent to event photos/videos for awareness and publicity, confirm I am 18+ or have parent/guardian consent, and agree my data is used to manage this event.</span></label>
                <label>Type your full name as your signature<input name="signature_name" type="text" minLength={2} maxLength={80} placeholder="Your full name" required /></label>
              </>}
              {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
              <button className="button button-dark form-submit" disabled={busy} type="submit">{busy ? 'Please wait…' : loginMode ? 'Sign in' : 'Create my account'} <span>↗</span></button>
            </form>
            <p className="form-switch">{loginMode ? 'New to the run?' : 'Already registered?'} <button type="button" onClick={() => { setLoginMode(!loginMode); setError(''); setMessage('') }}>{loginMode ? 'Create an account' : 'Sign in'}</button></p>
          </>}
        </div>
      </div></section>

      <section className="contact-section" id="contact"><div className="contact-card"><div className="section-kicker">QUESTIONS ABOUT THE RUN?</div><h2>LET’S TALK.</h2><a href="tel:+919994420724" className="contact-phone">+91 99944 20724</a><div className="contact-actions"><a className="button button-lime" href="tel:+919994420724">Call us <span>↗</span></a><a className="button button-light" href="https://wa.me/919994420724" target="_blank" rel="noreferrer">WhatsApp</a></div></div></section>

      <footer className="site-footer"><div className="footer-top"><div><a className="footer-logo" href="#home">RUN FREE<span> / 2027</span></a><p>Against Substance Abuse.<br />A community run by NSS Unit No. 180, MBCCET.</p><p className="footer-address">Mar Baselios Christian College of Engineering & Technology, Peermade, Kuttikkanam, Idukki, 685531.</p></div><div className="footer-links"><span className="footer-label">EXPLORE</span><a href="#why">Why we run</a><a href="#route">The route</a><a href="#day">The day</a><a href="#register">Register</a></div><div className="footer-social"><span className="footer-label">FOLLOW ALONG</span><a href="https://www.instagram.com/nss_mbc" target="_blank" rel="noopener noreferrer">@nss_mbc <span>↗</span></a><p>Organised with Toofan Commandos & Nasha Mukt Bharat Abhiyan.</p><details className="privacy-details"><summary>Privacy &amp; data use</summary><p>Your name, contact details and affiliation are collected to manage event registration and organiser updates. Registration records are visible only to authorised organisers and you. Email is handled by Supabase Auth. Map tiles may be served by OpenStreetMap or Esri; directions open Google Maps. Contact the organisers to request access or correction.</p></details></div></div><div className="footer-bottom"><span>© 2027 NSS Unit No. 180 · MBCCET</span><span>Run for a cause. Say NO to drugs. Say YES to life.</span><a href="#home">BACK TO TOP ↑</a></div></footer>
    </main>
  )
}
