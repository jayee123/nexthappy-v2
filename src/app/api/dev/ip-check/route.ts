import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json({ outboundIp: data.ip })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
