import { describe, test, expect } from 'vitest'
import { generateKeyPairSync } from 'crypto'
import {
  calcCheckValue,
  genSendTime,
  toPem,
  buildSignedRequest,
  type SunpayConfig,
} from '../sunpay'

// ─── 已知答案向量（文件 §4.2.3 手冊 V1.0.4）────────────
// sorted body/head → encodeURIComponent → +SHA2密鑰 → sha256
const DOC_SHA2_SECRET = 'D2AE96E5528531CFCDE90591695F973D23846ABD01A639AB1D3E0322D56E0ED9'
// ⚠️ 文件 p.17 印出的範例字串尾端少一個 %7D（PDF 截斷）；完整字串應以 %7D%7D 收尾。
// encodeURIComponent(JSON.stringify(sorted)) 產生的即為此完整字串（已本地驗證重現 check_value）。
const DOC_ENCODED =
  '%7B%22body%22%3A%7B%22email%22%3A%22test%40esafe.com.tw%22%2C%22mn%22%3A%2210%22%2C%22order_info%22%3A%22test%22%2C%22save_card_token%22%3A%22test%22%2C%22sdt%22%3A%220911123123%22%2C%22sna%22%3A%22test%22%2C%22td%22%3A%22TT1697708818%22%7D%2C%22head%22%3A%7B%22send_time%22%3A%2259758461720231019%22%2C%22web%22%3A%22MC31793850%22%7D%7D'
const DOC_EXPECTED_CHECK_VALUE =
  '152c3234ee7422af6e8f2fe1132a2391b99a552bac6070549d727a67e5b213fc'

// 本地產生的 1024-bit 公鑰，僅供 rsamsg 加密不報錯用（check_value 與此無關）
const DUMMY_PUBLIC_KEY = generateKeyPairSync('rsa', {
  modulusLength: 1024,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}).publicKey

describe('calcCheckValue — 文件已知答案向量', () => {
  test('reproduces doc §4.2.3 check_value exactly', () => {
    expect(calcCheckValue(DOC_ENCODED, DOC_SHA2_SECRET)).toBe(DOC_EXPECTED_CHECK_VALUE)
  })

  // 端到端：用真實簽名路徑（sort→stringify→encodeURIComponent→sha256）從物件重現
  test('buildSignedRequest reproduces doc check_value end-to-end', () => {
    // 文件 send_time "59758461720231019" = 台灣時間 2023-10-19 17:46:58.597
    // → UTC 09:46:58.597（+8h 後為台灣牆上時間）
    const docDate = new Date(Date.UTC(2023, 9, 19, 9, 46, 58, 597))
    const config: SunpayConfig = {
      web: 'MC31793850',
      sha2Secret: DOC_SHA2_SECRET,
      rsaPublicKeyPem: DUMMY_PUBLIC_KEY,
      tradeUrl: 'x',
      isProduction: false,
    }
    // 文件 §4.2.3 簽名範例 body（無 save_card / version）
    const docBody: Record<string, string> = {
      email: 'test@esafe.com.tw',
      mn: '10',
      order_info: 'test',
      save_card_token: 'test',
      sdt: '0911123123',
      sna: 'test',
      td: 'TT1697708818',
    }
    const req = buildSignedRequest(config, docBody, docDate)
    expect(req.send_time).toBe('59758461720231019')
    expect(req.check_value).toBe(DOC_EXPECTED_CHECK_VALUE)
  })
})

describe('genSendTime', () => {
  test('format is fffssmmHHyyyyMMdd (17 chars), in Taiwan time (UTC+8)', () => {
    // UTC 08:20 → 台灣 16:20；毫秒610 秒41 分20 時16 年2024 月11 日25
    const d = new Date(Date.UTC(2024, 10, 25, 8, 20, 41, 610))
    const s = genSendTime(d)
    expect(s).toHaveLength(17)
    expect(s).toBe('610412016' + '20241125')
  })
})

describe('toPem', () => {
  test('wraps single-line base64 into PEM', () => {
    const pem = toPem('AAAABBBBCCCC')
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(pem).toContain('-----END PUBLIC KEY-----')
  })
  test('passes through existing PEM unchanged', () => {
    const existing = '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----'
    expect(toPem(existing)).toBe(existing)
  })
})

// ─── RSA 加密分段長度邏輯（用本地產生的 1024-bit 金鑰對）──
// 說明：正式串接時，加密用紅陽公鑰、解密用同一把公鑰（紅陽私鑰加密回傳）。
// 這裡用自產金鑰對驗證分段長度邏輯正確（117 加密 / 128 密文區塊）。
describe('rsamsg 分段加密邏輯', () => {
  const { publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const config: SunpayConfig = {
    web: 'MC31793850',
    sha2Secret: DOC_SHA2_SECRET,
    rsaPublicKeyPem: publicKey,
    tradeUrl: 'https://testtrade.sunpay.com.tw/v3/token',
    isProduction: false,
  }

  test('buildSignedRequest produces the 4 outer fields', () => {
    const req = buildSignedRequest(config, {
      email: 'test@esafe.com.tw',
      mn: '10',
      td: 'TT1697708818',
    })
    expect(req.web).toBe('MC31793850')
    expect(req.send_time).toHaveLength(17)
    expect(typeof req.rsamsg).toBe('string')
    expect(req.rsamsg.length).toBeGreaterThan(0)
    expect(req.check_value).toMatch(/^[0-9a-f]{64}$/)
  })

  test('long payload encrypts into multiple 128-byte blocks', () => {
    const longBody: Record<string, string> = {
      email: 'test@esafe.com.tw',
      order_info: 'x'.repeat(200), // 迫使超過 117 byte，需分段
      td: 'TT1697708818',
    }
    const req = buildSignedRequest(config, longBody)
    const cipher = Buffer.from(req.rsamsg, 'base64')
    expect(cipher.length % 128).toBe(0)
    expect(cipher.length).toBeGreaterThan(128) // 至少 2 段
  })
})
