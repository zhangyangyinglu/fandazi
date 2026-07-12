/**
 * 将 Supabase / 网络错误消息翻译为中文友好提示
 */

const ERROR_MAP: Record<string, string> = {
  'Email not confirmed': '邮箱还没有确认。请先去邮箱里点 Supabase 发来的确认链接；如果只是本地测试，也可以在 Supabase → Authentication → Providers → Email 里关闭 Confirm email。确认后回来点"登录"。',
  'Invalid login credentials': '邮箱或密码不对，请检查后重试',
  'User already registered': '这个邮箱已经注册过了，直接登录就好',
  'Password should be at least 6 characters': '密码至少 6 位',
  'Email rate limit exceeded': '请求太频繁了，请稍等一分钟再试',
  'Database error saving new user': '注册时出了点问题，请稍后重试',
  'Unable to validate email address': '邮箱格式不对，请检查',
  'Session missing': '登录已过期，请重新登录',
  'JWT expired': '登录已过期，请重新登录',
  'Network request failed': '网络连接失败，请检查网络后重试',
  'Failed to fetch': '网络连接失败，请检查网络后重试',
  'fetch failed': '网络连接失败，请检查网络后重试',
}

export function friendlyError(rawError: string): string {
  // 精确匹配
  if (ERROR_MAP[rawError]) return ERROR_MAP[rawError]

  // 模糊匹配
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (rawError.includes(key)) return val
  }

  // 超长错误截断
  if (rawError.length > 200) {
    return rawError.slice(0, 200) + '…'
  }

  return rawError
}
