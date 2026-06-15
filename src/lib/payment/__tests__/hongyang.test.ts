import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
  encrypt,
  decrypt,
  chkValueBinding,
  chkValueCallback,
  chkValuePasscode,
  chkValuePayment,
  verifyCallbackChkValue,
  buildBindingFormParams,
  generateOrderNo,
  getHongyangConfig,
  type HongyangConfig,
} from '../hongyang'

// ─── Test fixtures ──────────────────────────────────────

const TEST_ENC_KEY = 'AcLI1TSwXR2pj5cTjr8elVoLktDFu/6r1W5ac/hU3p8='
const TEST_ENC_IV = 'buM3Eyc09w+K4uXzflKf0A=='
const TEST_MERCHANT_ID = 'S2502249051'
const TEST_PASSWORD = 'NE7rnR7td9rdNVV'

const TEST_CONFIG: HongyangConfig = {
  merchantId: TEST_MERCHANT_ID,
  password: TEST_PASSWORD,
  encKey: TEST_ENC_KEY,
  encIv: TEST_ENC_IV,
  bindUrl: 'https://test.esafe.com.tw/Service/Etopm.aspx',
  passcodeUrl: 'https://test.esafe.com.tw/ServiceAPP/API/Passcode_Request.ashx',
  transUrl: 'https://test.esafe.com.tw/ServiceAPP/API/Token_Payment.ashx',
  isProduction: false,
}

// ─── H.1: getHongyangConfig ────────────────────────────

describe('getHongyangConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  test('throws when env vars are missing', () => {
    delete process.env.HONGYANG_MERCHANT_ID
    delete process.env.HONGYANG_PASSWORD
    expect(() => getHongyangConfig()).toThrow('Missing HONGYANG env vars')
  })

  test('returns config when all env vars present', () => {
    process.env.HONGYANG_MERCHANT_ID = TEST_MERCHANT_ID
    process.env.HONGYANG_PASSWORD = TEST_PASSWORD
    process.env.HONGYANG_ENC_KEY = TEST_ENC_KEY
    process.env.HONGYANG_ENC_IV = TEST_ENC_IV
    process.env.HONGYANG_BIND_URL = 'https://test.esafe.com.tw/Service/Etopm.aspx'
    process.env.HONGYANG_PASSCODE_URL = 'https://test.esafe.com.tw/ServiceAPP/API/Passcode_Request.ashx'
    process.env.HONGYANG_TRANS_URL = 'https://test.esafe.com.tw/ServiceAPP/API/Token_Payment.ashx'
    process.env.HONGYANG_PRODUCTION = 'false'

    const config = getHongyangConfig()
    expect(config.merchantId).toBe(TEST_MERCHANT_ID)
    expect(config.isProduction).toBe(false)
  })

  test('isProduction=true when HONGYANG_PRODUCTION=true', () => {
    process.env.HONGYANG_MERCHANT_ID = TEST_MERCHANT_ID
    process.env.HONGYANG_PASSWORD = TEST_PASSWORD
    process.env.HONGYANG_ENC_KEY = TEST_ENC_KEY
    process.env.HONGYANG_ENC_IV = TEST_ENC_IV
    process.env.HONGYANG_BIND_URL = 'https://www.esafe.com.tw/Service/Etopm.aspx'
    process.env.HONGYANG_PASSCODE_URL = 'https://www.esafe.com.tw/ServiceAPP/API/Passcode_Request.ashx'
    process.env.HONGYANG_TRANS_URL = 'https://www.esafe.com.tw/ServiceAPP/API/Token_Payment.ashx'
    process.env.HONGYANG_PRODUCTION = 'true'

    const config = getHongyangConfig()
    expect(config.isProduction).toBe(true)
  })
})

// ─── H.2: encrypt / decrypt round-trip ──────────────────

describe('encrypt / decrypt', () => {
  test('round-trip with ASCII data', () => {
    const data = { name: 'test', amount: 100 }
    const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
    const decrypted = decrypt(encrypted, TEST_ENC_KEY, TEST_ENC_IV)
    expect(decrypted).toEqual(data)
  })

  test('round-trip with Chinese characters', () => {
    const data = { name: '張三', plan: 'Premium 整合', price: 1888 }
    const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
    const decrypted = decrypt(encrypted, TEST_ENC_KEY, TEST_ENC_IV)
    expect(decrypted).toEqual(data)
  })

  test('round-trip with special characters and slashes', () => {
    const data = { url: 'https://example.com/path?q=1&b=2', emoji: '✅' }
    const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
    const decrypted = decrypt(encrypted, TEST_ENC_KEY, TEST_ENC_IV)
    expect(decrypted).toEqual(data)
  })

  test('handles URL-encoded base64 with spaces', () => {
    const data = { test: 'value' }
    const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
    const withSpaces = encrypted.replace(/\+/g, ' ')
    const decrypted = decrypt(withSpaces, TEST_ENC_KEY, TEST_ENC_IV)
    expect(decrypted).toEqual(data)
  })

  test('decrypt fails with wrong key', () => {
    const data = { secret: 'data' }
    const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
    const wrongKey = 'g7dpkNf2ogVl4Bwo4zvJwxHa+hHaeHbJ5Id+ebLOQo8='
    expect(() => decrypt(encrypted, wrongKey, TEST_ENC_IV)).toThrow()
  })
})

// ─── H.3: chkValueBinding (SHA1 uppercase) ──────────────

describe('chkValueBinding', () => {
  test('produces uppercase SHA1', () => {
    const result = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', '')
    expect(result).toMatch(/^[A-F0-9]{40}$/)
  })

  test('is deterministic', () => {
    const a = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '299', '')
    const b = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '299', '')
    expect(a).toBe(b)
  })

  test('different amount produces different hash', () => {
    const a = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '299', '')
    const b = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', '')
    expect(a).not.toBe(b)
  })

  test('with term produces different hash', () => {
    const a = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '299', '')
    const b = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '299', '03')
    expect(a).not.toBe(b)
  })
})

// ─── H.3 cont: chkValueCallback (SHA1 uppercase) ───────

describe('chkValueCallback', () => {
  test('produces uppercase SHA1', () => {
    const result = chkValueCallback(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', '2606101800abc1234567')
    expect(result).toMatch(/^[A-F0-9]{40}$/)
  })

  test('matches binding formula for same inputs', () => {
    const binding = chkValueBinding(TEST_MERCHANT_ID, TEST_PASSWORD, '100', 'ORDER123')
    const callback = chkValueCallback(TEST_MERCHANT_ID, TEST_PASSWORD, '100', 'ORDER123')
    expect(binding).toBe(callback)
  })
})

// ─── H.4: chkValuePasscode (SHA256 lowercase) ──────────

describe('chkValuePasscode', () => {
  test('produces lowercase SHA256', () => {
    const rawJson = JSON.stringify({ timestamp: 1234567890, price: 100 })
    const result = chkValuePasscode(TEST_MERCHANT_ID, TEST_PASSWORD, rawJson)
    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })

  test('is deterministic', () => {
    const json = '{"test":1}'
    const a = chkValuePasscode(TEST_MERCHANT_ID, TEST_PASSWORD, json)
    const b = chkValuePasscode(TEST_MERCHANT_ID, TEST_PASSWORD, json)
    expect(a).toBe(b)
  })
})

// ─── H.5: chkValuePayment (SHA256 lowercase) ───────────

describe('chkValuePayment', () => {
  test('produces lowercase SHA256', () => {
    const rawJson = JSON.stringify({ passcode: '12345', price: 1888 })
    const result = chkValuePayment(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', '', rawJson)
    expect(result).toMatch(/^[a-f0-9]{64}$/)
  })

  test('empty term is included in hash', () => {
    const json = '{"test":1}'
    const withEmpty = chkValuePayment(TEST_MERCHANT_ID, TEST_PASSWORD, '100', '', json)
    const withTerm = chkValuePayment(TEST_MERCHANT_ID, TEST_PASSWORD, '100', '03', json)
    expect(withEmpty).not.toBe(withTerm)
  })
})

// ─── verifyCallbackChkValue ─────────────────────────────

describe('verifyCallbackChkValue', () => {
  test('returns true for valid signature', () => {
    const expected = chkValueCallback(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', 'ORDER001')
    const result = verifyCallbackChkValue({
      web: TEST_MERCHANT_ID,
      password: TEST_PASSWORD,
      mn: '1888',
      td: 'ORDER001',
      receivedChkValue: expected,
    })
    expect(result).toBe(true)
  })

  test('returns false for tampered amount', () => {
    const expected = chkValueCallback(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', 'ORDER001')
    const result = verifyCallbackChkValue({
      web: TEST_MERCHANT_ID,
      password: TEST_PASSWORD,
      mn: '999',
      td: 'ORDER001',
      receivedChkValue: expected,
    })
    expect(result).toBe(false)
  })

  test('returns false for tampered order', () => {
    const expected = chkValueCallback(TEST_MERCHANT_ID, TEST_PASSWORD, '1888', 'ORDER001')
    const result = verifyCallbackChkValue({
      web: TEST_MERCHANT_ID,
      password: TEST_PASSWORD,
      mn: '1888',
      td: 'ORDER999',
      receivedChkValue: expected,
    })
    expect(result).toBe(false)
  })
})

// ─── buildBindingFormParams ─────────────────────────────

describe('buildBindingFormParams', () => {
  test('produces complete form params', () => {
    const params = buildBindingFormParams(TEST_CONFIG, {
      amount: 1888,
      orderNo: 'ORD001',
      orderInfo: 'Premium 整合:月訂閱',
      userName: '張三',
      userPhone: '+886912345678',
      userEmail: 'test@example.com',
      userId: 'user-uuid-123',
      callbackUrl: 'https://example.com/api/payment/webhook',
    })

    expect(params.web).toBe(TEST_MERCHANT_ID)
    expect(params.MN).toBe('1888')
    expect(params.Td).toBe('ORD001')
    expect(params.Card_Type).toBe('2')
    expect(params.userID).toBe('user-uuid-123')
    expect(params.note1).toBe('user-uuid-123')
    expect(params.sdt).toBe('886912345678')
    expect(params.ChkValue).toMatch(/^[A-F0-9]{40}$/)
    expect(params.Term).toBe('')
  })

  test('strips non-digits from phone', () => {
    const params = buildBindingFormParams(TEST_CONFIG, {
      amount: 299,
      orderNo: 'ORD002',
      orderInfo: 'Basic',
      userName: 'Test',
      userPhone: '+886-912-345-678',
      userEmail: 'test@test.com',
      userId: 'u1',
      callbackUrl: 'https://example.com/webhook',
    })
    expect(params.sdt).toBe('886912345678')
  })
})

// ─── generateOrderNo ────────────────────────────────────

describe('generateOrderNo', () => {
  test('produces 20-char string (YYMMDDHHmm + 7id + 3rand)', () => {
    const result = generateOrderNo('abc1234')
    expect(result.length).toBe(20)
    expect(result).toMatch(/^\d{20}$/)
  })

  test('pads short IDs', () => {
    const result = generateOrderNo('ab')
    expect(result.length).toBe(20)
  })

  test('truncates long IDs to 7 chars', () => {
    const result = generateOrderNo('abcdefghijklmnop')
    expect(result.length).toBe(20)
  })

  test('strips hyphens from UUID-style IDs', () => {
    const a = generateOrderNo('abc-def-123')
    const b = generateOrderNo('abcdef1')
    expect(a.slice(10, 17)).toBe(b.slice(10, 17))
    expect(a).toMatch(/^\d{20}$/)
  })
})
