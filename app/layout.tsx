import './globals.css'
import type { ReactNode } from 'react'
import { Sidebar } from './sidebar'

export const metadata = {
  title: 'Metacode Marketing',
  description: 'Metacode 통합 마케팅 대시보드',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="content">{children}</div>
        </div>
      </body>
    </html>
  )
}
