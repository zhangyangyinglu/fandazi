import {
  getAdminClient,
  hashHandoffToken,
  isOptions,
  isPost,
  jsonResponse,
} from '../_shared/authHandoff.ts'

interface HandoffRequestBody {
  token?: unknown
}

Deno.serve(async (request) => {
  if (isOptions(request)) return jsonResponse(request, { ok: true })
  if (!isPost(request)) return jsonResponse(request, { error: 'method_not_allowed' }, 405)

  try {
    const body = await request.json() as HandoffRequestBody
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (token.length < 32 || token.length > 128) {
      return jsonResponse(request, { error: 'invalid_handoff' }, 400)
    }

    const admin = getAdminClient()
    const tokenHash = await hashHandoffToken(token)
    const now = new Date().toISOString()
    const { data: pending, error: lookupError } = await admin
      .from('auth_handoff_requests')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .is('claimed_at', null)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .maybeSingle()

    if (lookupError || !pending) {
      return jsonResponse(request, { error: 'handoff_expired' }, 410)
    }

    // 原子领取，防止两个手机同时扫描同一个二维码。
    const { data: claimed, error: claimError } = await admin
      .from('auth_handoff_requests')
      .update({ claimed_at: now })
      .eq('id', pending.id)
      .is('claimed_at', null)
      .is('consumed_at', null)
      .select('id, user_id')
      .maybeSingle()

    if (claimError || !claimed) {
      return jsonResponse(request, { error: 'handoff_already_used' }, 409)
    }

    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(claimed.user_id)
    const email = userResult.user?.email
    if (userError || !email) {
      await admin.from('auth_handoff_requests').update({ claimed_at: null }).eq('id', claimed.id)
      return jsonResponse(request, { error: 'handoff_unavailable' }, 500)
    }

    // 只生成一次性 email token hash；不把 Mac 的 access/refresh token 交给手机。
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const tokenHashForPhone = (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token

    if (linkError || !tokenHashForPhone) {
      await admin.from('auth_handoff_requests').update({ claimed_at: null }).eq('id', claimed.id)
      console.error('auth handoff token generation failed')
      return jsonResponse(request, { error: 'handoff_unavailable' }, 500)
    }

    const { error: consumeError } = await admin
      .from('auth_handoff_requests')
      .update({ claimed_at: now, consumed_at: new Date().toISOString() })
      .eq('id', claimed.id)
      .is('consumed_at', null)

    if (consumeError) {
      console.error('auth handoff consume failed')
      return jsonResponse(request, { error: 'handoff_unavailable' }, 500)
    }

    return jsonResponse(request, { tokenHash: tokenHashForPhone })
  } catch (error) {
    console.error('auth handoff complete error', error instanceof Error ? error.message : 'unknown')
    return jsonResponse(request, { error: 'invalid_handoff' }, 400)
  }
})
