'use client'

import { useState } from 'react'

type PlanTier = 'basic' | 'advanced' | 'premium'

const PLANS: { tier: PlanTier; label: string; price: number }[] = [
  { tier: 'basic', label: 'Basic 啟動', price: 10 },
  { tier: 'advanced', label: 'Advanced 深化', price: 699 },
  { tier: 'premium', label: 'Premium 整合', price: 1888 },
]

export default function TestPaymentPage() {
  const [log, setLog] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  async function handleBindCard(tier: PlanTier) {
    setLoading(true)
    addLog(`呼叫 bind-card API: tier=${tier}`)

    try {
      const res = await fetch('/api/payment/bind-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })

      const data = await res.json()

      if (!res.ok || data.error || !data.payUrl) {
        addLog(`bind-card 失敗: ${data.error || `HTTP ${res.status}`}`)
        setLoading(false)
        return
      }

      addLog(`bind-card 成功: transactionId=${data.transactionId}`)
      addLog(`導向紅陽支付頁: ${data.payUrl}`)

      // SunPay 首次付款：直接導向 pay_code 支付頁輸入卡號
      window.location.href = data.payUrl
    } catch (err) {
      addLog(`錯誤: ${err}`)
      setLoading(false)
    }
  }

  async function handleCheckout(action: string, targetTier?: PlanTier) {
    setLoading(true)
    addLog(`呼叫 checkout API: action=${action} tier=${targetTier || 'N/A'}`)

    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetTier }),
      })

      const data = await res.json()
      addLog(`checkout 回應: ${JSON.stringify(data, null, 2)}`)
    } catch (err) {
      addLog(`錯誤: ${err}`)
    }

    setLoading(false)
  }

  async function handleCron(path: string) {
    addLog(`呼叫 cron: ${path}`)

    try {
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${prompt('輸入 CRON_SECRET') || ''}` },
      })

      const data = await res.json()
      addLog(`cron 回應: ${JSON.stringify(data)}`)
    } catch (err) {
      addLog(`錯誤: ${err}`)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'monospace', padding: '0 20px' }}>
      <h1>Payment Integration Test</h1>
      <p style={{ color: '#888' }}>此頁僅供測試，正式上線前刪除</p>

      <hr />

      <h2>Step 1: 綁卡 (bind-card → 紅陽)</h2>
      <p>選一個方案，會跳轉到紅陽測試頁面綁卡</p>
      <p style={{ color: '#c60', fontSize: 12 }}>
        測試卡號: 4938-1701-8888-8994 / 到期: 12/28 / CVV: 541
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {PLANS.map((p) => (
          <button
            key={p.tier}
            onClick={() => handleBindCard(p.tier)}
            disabled={loading}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            {p.label} (${p.price})
          </button>
        ))}
      </div>

      <hr />

      <h2>Step 2: Checkout (升級/降級/取消)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => handleCheckout('subscribe', 'basic')} disabled={loading}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Subscribe Basic
        </button>
        <button onClick={() => handleCheckout('upgrade', 'advanced')} disabled={loading}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Upgrade → Advanced
        </button>
        <button onClick={() => handleCheckout('upgrade', 'premium')} disabled={loading}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Upgrade → Premium
        </button>
        <button onClick={() => handleCheckout('downgrade', 'basic')} disabled={loading}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Downgrade → Basic
        </button>
        <button onClick={() => handleCheckout('cancel')} disabled={loading}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>

      <hr />

      <h2>Step 3: Cron (手動觸發)</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => handleCron('/api/cron/expire-trials')}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Expire Trials
        </button>
        <button onClick={() => handleCron('/api/cron/charge-renewals')}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Charge Renewals
        </button>
        <button onClick={() => handleCron('/api/cron/retry-failed')}
          style={{ padding: '8px 12px', cursor: 'pointer' }}>
          Retry Failed
        </button>
      </div>

      <hr />

      <h2>Log</h2>
      <div style={{
        background: '#111',
        color: '#0f0',
        padding: 16,
        borderRadius: 4,
        maxHeight: 400,
        overflowY: 'auto',
        fontSize: 13,
        whiteSpace: 'pre-wrap',
      }}>
        {log.length === 0 ? '等待操作...' : log.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      <button onClick={() => setLog([])} style={{ marginTop: 8, cursor: 'pointer' }}>
        清除 Log
      </button>
    </div>
  )
}
