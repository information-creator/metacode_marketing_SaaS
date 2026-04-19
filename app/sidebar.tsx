'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { href: string; label: string; section?: string }

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', section: '대시보드' },
  { href: '/messaging', label: '종합', section: '문자하랑' },
  { href: '/messaging/sms', label: '문자 (SMS/LMS/MMS)' },
  { href: '/messaging/kakao', label: '카카오톡 (알림톡/친구톡)' },
  { href: '/ads/google', label: 'Google Ads', section: '광고' },
  { href: '/ads/meta', label: 'Meta Ads' },
  { href: '/sync', label: 'Sync Status', section: '운영' },
  { href: '/benchmarks', label: '평가 기준', section: '참고' },
]

export function Sidebar() {
  const pathname = usePathname()
  let lastSection = ''
  return (
    <aside className="sidebar">
      <div className="sidebar__brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/metacode-icon.png" alt="Metacode" width={28} height={28} style={{ borderRadius: 6 }} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Metacode Marketing</span>
      </div>
      {NAV.map((item) => {
        const showSection = item.section && item.section !== lastSection
        if (item.section) lastSection = item.section
        const active = pathname === item.href
        return (
          <div key={item.href}>
            {showSection && <div className="sidebar__section">{item.section}</div>}
            <Link href={item.href} className={`sidebar__link${active ? ' is-active' : ''}`}>
              <span className="sidebar__dot" />
              {item.label}
            </Link>
          </div>
        )
      })}
    </aside>
  )
}
