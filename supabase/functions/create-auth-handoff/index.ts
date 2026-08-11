import {
  HANDOFF_TTL_SECONDS,
  createHandoffToken,
  getAdminClient,
  getAuthenticatedUser,
  hashHandoffToken,
  isOptions,
  isPost,
  jsonResponse,
} from '../_shared/authHandoff.ts'

Deno.serve(async (request) => {
  if (isOptions(request)) return jsonResponse(request, { ok: true })
  if (!isPost(request)) return jsonResponse(request, { error: 'method_not_allowed' }, 405)

  try {
    const user = await getAuthenticatedUser(request)
    if (!user) return jsonResponse(request, { error: 'unauthorized' }, 401)

    const admin = getAdminClient()
    // 同一账号只保留最新的待扫码请求，避免旧二维码继续可用。
    await admin
      .from('auth_handoff_requests')
      .delete()
      .eq('user_id', user.id)
      .is('claimed_at', null)
      .is('consumed_at', null)

    const token = createHandoffToken()
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString()
    const tokenHash = await hashHandoffToken(token)
    const { error } = await admin.from('auth_handoff_requests').insert({
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt,
    })

    if (error) {
      console.error('auth handoff create failed')
      return jsonResponse(request, { error: 'handoff_unavailable' }, 500)
    }

    return jsonResponse(request, { token, expiresAt })
  } catch (error) {
    console.error('auth handoff create error', error instanceof Error ? error.message : 'unknown')
    return jsonResponse(request, { error: 'handoff_unavailable' }, 500)
  }
})
