import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { chargeToken, encrypt, type HongyangConfig, type ChargeTokenInput } from '../hongyang'

const TEST_ENC_KEY = 'AcLI1TSwXR2pj5cTjr8elVoLktDFu/6r1W5ac/hU3p8='
const TEST_ENC_IV = 'buM3Eyc09w+K4uXzflKf0A=='

const CONFIG: HongyangConfig = {
  merchantId: 'S2502249051',
  password: 'NE7rnR7td9rdNVV',
  encKey: TEST_ENC_KEY,
  encIv: TEST_ENC_IV,
  bindUrl: 'https://test.esafe.com.tw/Service/Etopm.aspx',
  passcodeUrl: 'https://test.esafe.com.tw/ServiceAPP/API/Passcode_Request.ashx',
  transUrl: 'https://test.esafe.com.tw/ServiceAPP/API/Token_Payment.ashx',
  isProduction: false,
}

const INPUT: ChargeTokenInput = {
  userId: 'user-123',
  paymentToken: 'AABBCCDD1122',
  verificationCode: 'enc-verify-code',
  tokenExpiryDate: '0231',
  amount: 1888,
  orderNo: 'REC_2606101800_001',
  orderInfo: 'Premium 整合月扣款',
}

function mockPasscodeResponse(passcode: string) {
  const encrypted = encrypt({ passcode }, TEST_ENC_KEY, TEST_ENC_IV)
  return { passcodeData: encrypted }
}

function mockPaymentResponse(errcode: string, errmsg: string, paymentString?: string) {
  const data: Record<string, unknown> = { errcode, errmsg }
  if (paymentString) data.paymentString = paymentString
  const encrypted = encrypt(data, TEST_ENC_KEY, TEST_ENC_IV)
  return { transactionResult: encrypted }
}

let fetchCallCount: number
let fetchCalls: { url: string; body: string }[]

beforeEach(() => {
  fetchCallCount = 0
  fetchCalls = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

// H.23-H.26: Successful two-stage charge

describe('chargeToken — success flow', () => {
  test('returns success when both stages succeed', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
      fetchCalls.push({ url, body: opts.body as string })
      fetchCallCount++

      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS12345')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(mockPaymentResponse('00', '交易成功')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(true)
    expect(result.errcode).toBe('00')
    expect(result.errmsg).toBe('交易成功')
    expect(result.needs3d).toBeUndefined()
    expect(fetchCalls).toHaveLength(2)
    expect(fetchCalls[0].url).toBe(CONFIG.passcodeUrl)
    expect(fetchCalls[1].url).toBe(CONFIG.transUrl)
  })

  test('Stage A sends correct merchantID and encrypted tokenData', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts: RequestInit) => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        const body = JSON.parse(opts.body as string)
        expect(body.merchantID).toBe(CONFIG.merchantId)
        expect(body.tokenData).toBeTruthy()
        expect(body.chkValue).toMatch(/^[a-f0-9]{64}$/)
        return new Response(JSON.stringify(mockPasscodeResponse('P999')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(mockPaymentResponse('00', 'ok')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    await chargeToken(CONFIG, INPUT)
  })

  test('Stage B sends passcode from Stage A in encrypted paymentData', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, opts: RequestInit) => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('MY_PASS_789')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const body = JSON.parse(opts.body as string)
      expect(body.merchantID).toBe(CONFIG.merchantId)
      expect(body.paymentToken).toBe(INPUT.paymentToken)
      expect(body.paymentData).toBeTruthy()
      expect(body.chkValue).toMatch(/^[a-f0-9]{64}$/)
      return new Response(JSON.stringify(mockPaymentResponse('00', 'ok')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, INPUT)
    expect(result.success).toBe(true)
  })
})

// H.27: 3D verification

describe('chargeToken — 3D verification', () => {
  test('returns needs3d=true when paymentString is present', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify(mockPaymentResponse('3D', '需要3D驗證', 'https://3d.esafe.com/verify?id=xxx')),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.needs3d).toBe(true)
    expect(result.errcode).toBe('3D')
  })
})

// H.28: Network failures

describe('chargeToken — network failures', () => {
  test('Stage A returns 500 → NETWORK error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response('Internal Server Error', { status: 500 })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.errcode).toBe('NETWORK')
    expect(result.errmsg).toContain('500')
  })

  test('Stage A returns 503 → NETWORK error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response('Service Unavailable', { status: 503 })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.errcode).toBe('NETWORK')
  })

  test('Stage B returns 500 → NETWORK error (Stage A succeeds)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('Internal Server Error', { status: 500 })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.errcode).toBe('NETWORK')
    expect(result.errmsg).toContain('Payment request failed')
  })
})

// Payment declined (errcode !== '00')

describe('chargeToken — payment declined', () => {
  test('errcode G0 (授權被拒)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(mockPaymentResponse('G0', '授權被拒')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.errcode).toBe('G0')
    expect(result.errmsg).toBe('授權被拒')
    expect(result.needs3d).toBeUndefined()
  })

  test('errcode G4 (卡片過期)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(mockPaymentResponse('G4', '卡片過期')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, INPUT)

    expect(result.success).toBe(false)
    expect(result.errcode).toBe('G4')
  })
})

// Amount edge cases

describe('chargeToken — amount edge cases', () => {
  test('minimum amount $1', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(mockPaymentResponse('00', 'ok')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, { ...INPUT, amount: 1 })
    expect(result.success).toBe(true)
  })

  test('large amount $1888', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      fetchCallCount++
      if (fetchCallCount === 1) {
        return new Response(JSON.stringify(mockPasscodeResponse('PASS')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify(mockPaymentResponse('00', 'ok')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const result = await chargeToken(CONFIG, { ...INPUT, amount: 1888 })
    expect(result.success).toBe(true)
  })
})
