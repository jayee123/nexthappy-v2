// SunPay（紅陽）信用卡代碼授權 API — RSA + SHA2 串接
// 依「紅陽科技金流服務-信用卡代碼授權技術串接手冊 V1.0.4」實作
// 取代舊的 esafe AES-256-CBC 系統（hongyang.ts）
//
// 加解密驗證：check_value 演算法已用文件 §4.2.3 測試向量本地重現通過
//   sha256(encodeURIComponent(sortedJSON) + SHA2_SECRET) === 152c3234...

import {
  createHash,
  publicEncrypt,
  publicDecrypt,
  constants,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto'

// ─── Config ─────────────────────────────────────────────

export interface SunpayConfig {
  web: string // 特店代號
  sha2Secret: string // SHA2 密鑰（簽名用）
  rsaPublicKeyPem: string // RSA 公鑰（PEM 格式）
  tradeUrl: string // /v3/token endpoint
  isProduction: boolean
}

const REQUIRED_ENV_KEYS = [
  'SUNPAY_WEB',
  'SUNPAY_SHA2_SECRET',
  'SUNPAY_RSA_PUBLIC_KEY',
  'SUNPAY_TRADE_URL',
] as const

export function getSunpayConfig(): SunpayConfig {
  const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing SUNPAY env vars: ${missing.join(', ')}`)
  }

  return {
    web: process.env.SUNPAY_WEB!,
    sha2Secret: process.env.SUNPAY_SHA2_SECRET!,
    rsaPublicKeyPem: toPem(process.env.SUNPAY_RSA_PUBLIC_KEY!),
    tradeUrl: process.env.SUNPAY_TRADE_URL!,
    isProduction: process.env.SUNPAY_PRODUCTION === 'true',
  }
}

// 把後台複製的單行 base64 公鑰轉成 PEM（若已是 PEM 則原樣返回）
export function toPem(key: string): string {
  const trimmed = key.trim()
  if (trimmed.includes('BEGIN PUBLIC KEY')) return trimmed
  const body = trimmed.replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`
}

// ─── 共用：排序 / URLEncode / 簽名 ───────────────────────

// 依 ASCII 升序遞迴排序物件 key（body 在 head 前，因 'b' < 'h'）
function sortByAscii(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const val = obj[key]
    sorted[key] =
      val && typeof val === 'object' && !Array.isArray(val)
        ? sortByAscii(val as Record<string, unknown>)
        : val
  }
  return sorted
}

// PHP urlencode 相容編碼（紅陽為 PHP 後端）：
// 與 encodeURIComponent 差異：空白→'+'，且額外編碼 ! ~ * ' ( )
export function phpUrlencode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

// PHP urldecode 相容解碼：'+' → 空白
function phpUrldecode(s: string): string {
  return decodeURIComponent(s.replace(/\+/g, '%20'))
}

// 產生 URLEncode 後的簽章來源字串（rsamsg 與 check_value 共用）
function buildEncodedString(head: Record<string, string>, body: Record<string, string>): string {
  const sorted = sortByAscii({ body, head })
  return phpUrlencode(JSON.stringify(sorted))
}

// check_value = sha256(urlEncoded + SHA2密鑰) 小寫 hex
export function calcCheckValue(encoded: string, sha2Secret: string): string {
  return createHash('sha256').update(encoded + sha2Secret).digest('hex')
}

// rsamsg = RSA 公鑰分段加密（每段 117 byte, PKCS#1 v1.5）後 base64
function encryptRsamsg(encoded: string, publicKeyPem: string): string {
  const data = Buffer.from(encoded, 'utf8')
  const CHUNK = 117 // 128(1024-bit) - 11(PKCS1 padding)
  const parts: Buffer[] = []
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.subarray(i, i + CHUNK)
    parts.push(
      publicEncrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING }, chunk),
    )
  }
  return Buffer.concat(parts).toString('base64')
}

// callback 解密（原始 URLencoded 字串）：base64decode → 每 128 byte 公鑰解密
// 紅陽的 check_value 是對「這個原始字串」+ 密鑰做 sha256，驗簽要用它。
export function decryptRsamsgRaw(rsamsgBase64: string, publicKeyPem: string): string {
  const cipher = Buffer.from(rsamsgBase64, 'base64')
  const CHUNK = 128 // 1024-bit block
  const parts: Buffer[] = []
  for (let i = 0; i < cipher.length; i += CHUNK) {
    const block = cipher.subarray(i, i + CHUNK)
    parts.push(publicDecrypt({ key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING }, block))
  }
  return Buffer.concat(parts).toString('utf8')
}

// callback 解密 → URLDecode → JSON
export function decryptRsamsg(rsamsgBase64: string, publicKeyPem: string): Record<string, unknown> {
  return JSON.parse(phpUrldecode(decryptRsamsgRaw(rsamsgBase64, publicKeyPem)))
}

// send_time 格式：fffssmmHHyyyyMMdd（毫秒3 + 秒2 + 分2 + 時2 + 年4 + 月2 + 日2 = 17 碼）
// ★ 必須用台灣時間（UTC+8）：紅陽伺服器在台灣，發起時間逾 120 秒視為無效。
// 容器跑 UTC，故把 epoch +8h 後讀 UTC 欄位取得台灣牆上時間。
const TW_OFFSET_MS = 8 * 3600 * 1000
export function genSendTime(now: Date = new Date()): string {
  const tw = new Date(now.getTime() + TW_OFFSET_MS)
  const p = (n: number, w: number) => String(n).padStart(w, '0')
  return (
    p(tw.getUTCMilliseconds(), 3) +
    p(tw.getUTCSeconds(), 2) +
    p(tw.getUTCMinutes(), 2) +
    p(tw.getUTCHours(), 2) +
    p(tw.getUTCFullYear(), 4) +
    p(tw.getUTCMonth() + 1, 2) +
    p(tw.getUTCDate(), 2)
  )
}

// ─── 交易請求外層封裝 ───────────────────────────────────

export interface SignedRequest {
  web: string
  send_time: string
  rsamsg: string
  check_value: string
}

// 把 body 參數封裝成可 POST 的 {web, send_time, rsamsg, check_value}
export function buildSignedRequest(
  config: SunpayConfig,
  body: Record<string, string>,
  now: Date = new Date(),
): SignedRequest {
  const sendTime = genSendTime(now)
  const head = { send_time: sendTime, web: config.web }
  const encoded = buildEncodedString(head, body)
  return {
    web: config.web,
    send_time: sendTime,
    rsamsg: encryptRsamsg(encoded, config.rsaPublicKeyPem),
    check_value: calcCheckValue(encoded, config.sha2Secret),
  }
}

// ─── 首次付款（4.3）───────────────────────────────────

export interface FirstPaymentInput {
  email: string
  amount: number
  orderInfo: string
  saveCardToken: string // 特店自訂卡片識別碼（如 user email / id）
  phone: string
  name: string
  orderNo: string // td
}

export interface FirstPaymentResult {
  success: boolean
  code: string
  msg: string
  payCode?: string // 紅陽支付頁 URL，另開視窗給消費者輸卡
  tradeNo?: string
}

export async function requestFirstPayment(
  config: SunpayConfig,
  input: FirstPaymentInput,
): Promise<FirstPaymentResult> {
  const body: Record<string, string> = {
    email: input.email,
    mn: String(input.amount),
    order_info: input.orderInfo,
    save_card: '2', // 強制保存卡號（代碼授權必須）
    save_card_token: input.saveCardToken,
    sdt: input.phone,
    sna: input.name,
    td: input.orderNo,
    version: '2',
  }

  // DEBUG（正式上線移除）：body 不含卡片資訊（卡號在紅陽支付頁輸入）
  console.log('[sunpay] first payment body:', JSON.stringify(body), 'send_time:', buildSignedRequest(config, body).send_time)

  const payload = buildSignedRequest(config, body)
  let res: Response
  try {
    res = await fetch(config.tradeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[sunpay] first payment fetch error:', err)
    return { success: false, code: 'NETWORK', msg: `連線失敗: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!res.ok) {
    return { success: false, code: 'NETWORK', msg: `HTTP ${res.status}` }
  }

  const json = (await res.json()) as {
    code?: string
    msg?: string
    result?: { pay_code?: string; trade_no?: string }
  }

  return {
    success: json.code === '00',
    code: json.code ?? '99',
    msg: json.msg ?? '',
    payCode: json.result?.pay_code,
    tradeNo: json.result?.trade_no,
  }
}

// ─── 後續付款（4.4）— 定期扣款 ─────────────────────────

export interface SubsequentPaymentInput {
  email: string
  amount: number
  orderInfo: string
  phone: string
  name: string
  saveCardToken: string // 首次定義那組
  orderNo: string // 新 td
  tokenKey: string // 首次 callback 回傳
}

export interface SubsequentPaymentResult {
  success: boolean
  code: string
  msg: string
  resultHtml?: string // 僅 3D 交易回傳
}

export async function requestSubsequentPayment(
  config: SunpayConfig,
  input: SubsequentPaymentInput,
): Promise<SubsequentPaymentResult> {
  const body: Record<string, string> = {
    email: input.email,
    mn: String(input.amount),
    order_info: input.orderInfo,
    save_card_token: input.saveCardToken,
    sdt: input.phone,
    sna: input.name,
    td: input.orderNo,
    token_key: input.tokenKey,
    version: '2',
  }

  const payload = buildSignedRequest(config, body)
  let res: Response
  try {
    res = await fetch(config.tradeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[sunpay] subsequent payment fetch error:', err)
    return { success: false, code: 'NETWORK', msg: `連線失敗: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!res.ok) {
    return { success: false, code: 'NETWORK', msg: `HTTP ${res.status}` }
  }

  const json = (await res.json()) as { code?: string; msg?: string; resultHtml?: string }
  return {
    success: json.code === '00',
    code: json.code ?? '99',
    msg: json.msg ?? '',
    resultHtml: json.resultHtml,
  }
}

// ─── Callback 解析與驗簽 ───────────────────────────────

export interface CallbackBody {
  approve_code?: string
  card_no?: string
  card_type?: string
  currency?: string
  mn?: string
  name?: string
  pay_date?: string
  pay_result?: string // 10 成功 / 11 失敗 / 12 已建立
  pay_time?: string
  td?: string
  trade_no?: string
  save_card_token_result?: string
  token_key?: string
  token_life?: string
}

export interface ParsedCallback {
  valid: boolean // check_value 驗簽是否通過
  head: { web?: string; send_time?: string }
  body: CallbackBody
  isSuccess: boolean // pay_result === '10'
}

// 解密 + 驗簽 callback 的 {web, send_time, rsamsg, check_value}
export function parseCallback(
  config: SunpayConfig,
  payload: { web?: string; send_time?: string; rsamsg: string; check_value: string },
): ParsedCallback {
  // 用「原始解密字串」驗簽（紅陽的 check_value 就是對此字串 + 密鑰 sha256）
  const raw = decryptRsamsgRaw(payload.rsamsg, config.rsaPublicKeyPem)
  const decrypted = JSON.parse(phpUrldecode(raw)) as {
    head?: Record<string, string>
    body?: CallbackBody
  }
  const head = decrypted.head ?? {}
  const body = decrypted.body ?? {}

  const expected = calcCheckValue(raw, config.sha2Secret)
  const valid = expected === payload.check_value

  return {
    valid,
    head,
    body,
    isSuccess: body.pay_result === '10',
  }
}

// ─── 訂單編號產生（td：英數，不可重複，≤50 碼）────────
export function generateOrderNo(seed: string, now: Date = new Date()): string {
  const p = (n: number, w: number) => String(n).padStart(w, '0')
  const ts =
    p(now.getFullYear() % 100, 2) +
    p(now.getMonth() + 1, 2) +
    p(now.getDate(), 2) +
    p(now.getHours(), 2) +
    p(now.getMinutes(), 2) +
    p(now.getSeconds(), 2)
  const suffix = seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)
  return `TT${ts}${suffix}`.slice(0, 50)
}

// ─── Token 落地儲存（at-rest AES-256-CBC，用 ENCRYPTION_KEY）──
// 存 save_card_token + token_key + token_life，後續扣款需要三者
export interface StoredToken {
  saveCardToken: string
  tokenKey: string
  tokenLife: string // YYYYMMDD
  boundAt: string // ISO
  customerName?: string // 綁卡時的消費者姓名，續扣沿用（無支付頁可輸入）
  customerPhone?: string // 綁卡時的消費者電話，續扣沿用
}

const AT_REST_ALGO = 'aes-256-cbc'

export function packToken(bundle: StoredToken, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex') // 32 bytes
  const iv = randomBytes(16)
  const cipher = createCipheriv(AT_REST_ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()])
  return Buffer.concat([iv, enc]).toString('base64')
}

export function unpackToken(packed: string, keyHex: string): StoredToken {
  const key = Buffer.from(keyHex, 'hex')
  const raw = Buffer.from(packed, 'base64')
  const iv = raw.subarray(0, 16)
  const enc = raw.subarray(16)
  const decipher = createDecipheriv(AT_REST_ALGO, key, iv)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as StoredToken
}
