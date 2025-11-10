export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabaseClient'

export async function POST(request: Request) {
  try {
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server is not configured with SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const { userId } = await request.json()
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Load the public user row, validate existence
    const { data: pubUser, error: readErr } = await adminSupabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 400 })
    }
    if (!pubUser) {
      return NextResponse.json({ error: 'User not found in public.users' }, { status: 404 })
    }

    // Soft delete: set is_deleted = true on public.users and do not remove auth user.
    const uid = pubUser.id
    const { error: updErr } = await adminSupabase.from('users').update({ is_deleted: true }).eq('id', uid)
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Failed to soft-delete user' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, softDeleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown server error' }, { status: 500 })
  }
}
