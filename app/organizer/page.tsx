import type { Metadata } from 'next'
import OrganizerDashboard from '@/components/organizer-dashboard'

export const metadata: Metadata = {
  title: 'Organizer Desk — RUN FREE 2027',
  description: 'Private organizer dashboard for RUN FREE 2027 event updates and runner registrations.',
  robots: { index: false, follow: false },
}

export default function OrganizerPage() {
  return <OrganizerDashboard />
}
