import { createHash, createCipheriv, createDecipheriv } from 'crypto'

const AES_ALGO = 'aes-256-cbc' as const

// ─── Config ─────────────────────────────────────────────

export interface HongyangConfig {
  merchantId: string
  password: string
  encKey: string
  encIv: string
  bindUrl: string
  passcodeUrl: string
  transUrl: string
  isProduction: boolean
}

const REQUIRED_ENV_KEYS = [
  'HONGYANG_MERCHANT_ID',
  'HONGYANG_PASSWORD',
  'HONGYANG_ENC_KEY',
  'HONGYANG_ENC_IV',
  'HONGYANG_BIND_URL',
  'HONGYANG_PASSCODE_URL',
  'HONGYANG_TRANS_URL',
] as const

export function getHongyangConfig(): HongyangConfig {
  const missing = REQUIRED_ENV_KEYS.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing HONGYANG env vars: ${missing.join(', ')}`)
  }

  return {
    merchantId: process.env.HONGYANG_MERCHANT_ID!,
    password: process.env.HONGYANG_PASSWORD!,
    encKey: process.env.HONGYANG_ENC_KEY!,
    encIv: process.env.HONGYANG_ENC_IV!,
    bindUrl: process.env.HONGYANG_BIND_URL!,
    passcodeUrl: process.env.HONGYANG_PASSCODE_URL!,
    transUrl: process.env.HONGYANG_TRANS_URL!,
    isProduction: process.env.HONGYANG_PRODUCTION === 'true',
  }
}

// ─── AES-256-CBC encrypt / decrypt ──────────────────────

export function encrypt(
  data: Record<string, unknown>,
  encKey: string,
  encIv: string,
): string {
  const json = JSON.stringify(data)
  const key = Buffer.from(encKey, 'base64')
  const iv = Buffer.from(encIv, 'base64')
  const cipher = createCipheriv(AES_ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  return encrypted.toString('base64')
}

export function decrypt(
  base64Str: string,
  encKey: string,
  encIv: string,
): Record<string, unknown> {
  const cleaned = decodeURIComponent(base64Str).replace(/ /g, '+')
  const key = Buffer.from(encKey, 'base64')
  const iv = Buffer.from(encIv, 'base64')
  const decipher = createDecipheriv(AES_ALGO, key, iv)
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cleaned, 'base64')),
    decipher.final(),
  ])
  return JSON.parse(decrypted.toString('utf8'))
}

// ─── ChkValue ───────────────────────────────────────────

export function chkValueBinding(merchantId: string, password: string, mn: string, term: string): string {
  const raw = merchantId + password + mn + term
  return createHash('sha1').update(raw).digest('hex').toUpperCase()
}

export function chkValueCallback(web: string, password: string, mn: string, td: string): string {
  const raw = web + password + mn + td
  return createHash('sha1').update(raw).digest('hex').toUpperCase()
}

export function chkValuePasscode(merchantId: string, password: string, rawJson: string): string {
  const raw = merchantId + password + rawJson
  return createHash('sha256').update(raw).digest('hex')
}

export function chkValuePayment(
  merchantId: string,
  password: string,
  price: string,
  term: string,
  rawJson: string,
): string {
  const raw = merchantId + password + price + term + rawJson
  return createHash('sha256').update(raw).digest('hex')
}

// ─── Verify callback signature ──────────────────────────

export function verifyCallbackChkValue(params: {
  web: string
  password: string
  mn: string
  td: string
  receivedChkValue: string
}): boolean {
  const local = chkValueCallback(params.web, params.password, params.mn, params.td)
  return local === params.receivedChkValue
}

// ─── Binding form params ────────────────────────────────

export interface BindingFormInput {
  amount: number
  orderNo: string
  orderInfo: string
  userName: string
  userPhone: string
  userEmail: string
  userId: string
  callbackUrl: string
}

export function buildBindingFormParams(
  config: HongyangConfig,
  input: BindingFormInput,
): Record<string, string> {
  const mn = String(input.amount)
  const term = ''
  return {
    web: config.merchantId,
    MN: mn,
    OrderInfo: input.orderInfo,
    Td: input.orderNo,
    sna: input.userName,
    sdt: input.userPhone.replace(/[^0-9]/g, ''),
    email: input.userEmail,
    note1: input.userId,
    note2: '',
    Card_Type: '2',
    userID: input.userId,
    paymentToken: '',
    paymentData: '',
    Term: term,
    TdReturnURL: input.callbackUrl,
    ChkValue: chkValueBinding(config.merchantId, config.password, mn, term),
  }
}

// ─── Order number generation ────────────────────────────

export function generateOrderNo(shortId: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const hex = shortId.replace(/-/g, '').slice(0, 7)
  const numeric = String(parseInt(hex, 16) || 0).slice(0, 7).padStart(7, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${yy}${mm}${dd}${hh}${mi}${numeric}${rand}`
}

// ─── Two-stage token charge ─────────────────────────────

export interface ChargeTokenInput {
  userId: string
  paymentToken: string
  verificationCode: string
  tokenExpiryDate: string
  amount: number
  orderNo: string
  orderInfo: string
}

export interface ChargeTokenResult {
  success: boolean
  errcode: string
  errmsg: string
  esafeNo?: string
  needs3d?: boolean
}

export async function chargeToken(
  config: HongyangConfig,
  input: ChargeTokenInput,
): Promise<ChargeTokenResult> {
  // Stage A: request passcode
  const tokenData = {
    timestamp: Math.floor(Date.now() / 1000),
    userID: input.userId,
    paymentToken: input.paymentToken,
    verificationCode: input.verificationCode,
    tokenExpiryDate: input.tokenExpiryDate,
    price: input.amount,
  }

  const tokenDataEncrypted = encrypt(tokenData, config.encKey, config.encIv)
  const tokenDataJson = JSON.stringify(tokenData)
  const passcodeChk = chkValuePasscode(config.merchantId, config.password, tokenDataJson)

  const passcodeRes = await fetch(config.passcodeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantID: config.merchantId,
      tokenData: tokenDataEncrypted,
      chkValue: passcodeChk,
    }),
  })

  if (!passcodeRes.ok) {
    return {
      success: false,
      errcode: 'NETWORK',
      errmsg: `Passcode request failed: ${passcodeRes.status}`,
    }
  }

  const passcodeBody = await passcodeRes.json()

  if (!passcodeBody.passcodeData) {
    return {
      success: false,
      errcode: passcodeBody.errcode || 'NO_PASSCODE',
      errmsg: passcodeBody.errmsg || `Passcode API 無回傳 passcodeData: ${JSON.stringify(passcodeBody)}`,
    }
  }

  let passcodeDecrypted: { passcode: string }
  try {
    passcodeDecrypted = decrypt(
      passcodeBody.passcodeData,
      config.encKey,
      config.encIv,
    ) as { passcode: string }
  } catch (err) {
    return {
      success: false,
      errcode: 'DECRYPT_FAIL',
      errmsg: `Passcode 解密失敗: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Stage B: execute payment
  const paymentData = {
    passcode: passcodeDecrypted.passcode,
    userID: input.userId,
    verificationCode: input.verificationCode,
    tokenExpiryDate: input.tokenExpiryDate,
    price: input.amount,
    orderNo: input.orderNo,
    orderInfo: input.orderInfo,
    cardType: '2',
    customerName: 'AutoPay',
  }

  const paymentDataEncrypted = encrypt(paymentData, config.encKey, config.encIv)
  const paymentDataJson = JSON.stringify(paymentData)
  const paymentChk = chkValuePayment(
    config.merchantId,
    config.password,
    String(input.amount),
    '',
    paymentDataJson,
  )

  const paymentRes = await fetch(config.transUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantID: config.merchantId,
      paymentToken: input.paymentToken,
      paymentData: paymentDataEncrypted,
      chkValue: paymentChk,
    }),
  })

  if (!paymentRes.ok) {
    return {
      success: false,
      errcode: 'NETWORK',
      errmsg: `Payment request failed: ${paymentRes.status}`,
    }
  }

  const paymentBody = await paymentRes.json()

  if (!paymentBody.transactionResult) {
    return {
      success: false,
      errcode: paymentBody.errcode || 'NO_RESULT',
      errmsg: paymentBody.errmsg || `Payment API 無回傳 transactionResult: ${JSON.stringify(paymentBody)}`,
    }
  }

  let result: { errcode: string; errmsg: string; paymentString?: string }
  try {
    result = decrypt(
      paymentBody.transactionResult,
      config.encKey,
      config.encIv,
    ) as { errcode: string; errmsg: string; paymentString?: string }
  } catch (err) {
    return {
      success: false,
      errcode: 'DECRYPT_FAIL',
      errmsg: `Payment 解密失敗: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (result.paymentString) {
    return {
      success: false,
      errcode: result.errcode,
      errmsg: result.errmsg,
      needs3d: true,
    }
  }

  return {
    success: result.errcode === '00',
    errcode: result.errcode,
    errmsg: result.errmsg,
  }
}
