import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getHongyangConfig, encrypt, decrypt, chkValuePasscode } from '@/lib/payment/hongyang'

export async function GET() {
  try {
    const config = getHongyangConfig()

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, payment_method_token')
      .eq('email', 'jeff@milkidea.com')
      .single()

    if (!user?.payment_method_token) {
      return NextResponse.json({ error: 'No token found' })
    }

    const stored = decrypt(user.payment_method_token, config.encKey, config.encIv) as Record<string, string>

    const tokenData = {
      timestamp: Math.floor(Date.now() / 1000),
      userID: user.id,
      paymentToken: stored.paymentToken,
      verificationCode: stored.verificationCode,
      tokenExpiryDate: stored.tokenExpiryDate,
      price: 1,
    }

    const tokenDataJson = JSON.stringify(tokenData)
    const tokenDataEncrypted = encrypt(tokenData, config.encKey, config.encIv)
    const chkValue = chkValuePasscode(config.merchantId, config.password, tokenDataJson)

    const body = {
      merchantID: config.merchantId,
      tokenData: tokenDataEncrypted,
      chkValue,
    }

    const res = await fetch(config.passcodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const resBody = await res.json()

    return NextResponse.json({
      request: {
        url: config.passcodeUrl,
        merchantID: config.merchantId,
        tokenDataJsonPreview: tokenDataJson.substring(0, 100) + '...',
        tokenDataJsonLength: tokenDataJson.length,
        tokenDataEncryptedLength: tokenDataEncrypted.length,
        chkValuePreview: chkValue.substring(0, 16) + '...',
        paymentTokenLength: stored.paymentToken?.length,
        verificationCodeLength: stored.verificationCode?.length,
        tokenExpiryDate: stored.tokenExpiryDate,
      },
      response: resBody,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
