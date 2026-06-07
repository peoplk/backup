'use client'

import { MobileApp } from '@/components/mobile-app'
import { DesktopApp } from '@/components/desktop-app'

const IS_CAPACITOR = process.env.NEXT_PUBLIC_IS_CAPACITOR === 'true'

export default function Home() {
  if (IS_CAPACITOR) {
    return <MobileApp />
  }

  return <DesktopApp />
}