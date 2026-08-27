'use client';

// 放置路徑：src/components/admin/AppearanceTab.tsx
//
// /admin/settings 的「外觀」分頁：調整公版欄位在後台表格裡的標示配色。
//
// 為什麼要即時預覽：
//   色票選出來的顏色，單看色塊看不出套在表頭上長怎樣（面積、字重、
//   旁邊灰色欄位的對照都會影響觀感）。直接把那排表頭畫出來最準。
//
// 為什麼只警告不擋：
//   自由選色是刻意的決定 —— 預設清單再長也總有人要別的顏色。
//   但自由選就可能選出看不清的組合，所以用 WCAG 對比度給出提醒，
//   由管理員自己判斷（他正看著預覽）。

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_MARKET_FIELD_BG,
  DEFAULT_MARKET_FIELD_FG,
  contrastRatio,
  WCAG_AA_NORMAL_TEXT,
} from '@/lib/admin/marketField';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function AppearanceTab() {
  const [bg, setBg] = useState(DEFAULT_MARKET_FIELD_BG);
  const [fg, setFg] = useState(DEFAULT_MARKET_FIELD_FG);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings/appearance');
        const json = await res.json();
        if (json.data) {
          setBg(json.data.bg);
          setFg(json.data.fg);
        }
      } catch {
        setMessage('讀取設定失敗，顯示的是預設值');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async () => {
    setSaveState('saving');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg, fg }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveState('error');
        setMessage(json.error ?? '儲存失敗');
        return;
      }
      setSaveState('saved');
      setMessage('已儲存。重新整理後全站後台生效。');
    } catch {
      setSaveState('error');
      setMessage('儲存失敗，請檢查網路後再試');
    }
  }, [bg, fg]);

  const reset = () => {
    setBg(DEFAULT_MARKET_FIELD_BG);
    setFg(DEFAULT_MARKET_FIELD_FG);
    setSaveState('idle');
    setMessage(null);
  };

  const ratio = contrastRatio(bg, fg);
  const passesAA = ratio >= WCAG_AA_NORMAL_TEXT;
  const isDirty = bg !== DEFAULT_MARKET_FIELD_BG || fg !== DEFAULT_MARKET_FIELD_FG;

  if (loading) {
    return <div className="px-4 py-12 text-center text-gray-400">載入中⋯</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-gray-800">公版欄位標示</h2>
        <p className="mt-1 text-sm text-gray-500 leading-relaxed">
          後台表格裡，資料來自公版（NUWA 市集）的欄位會用底色標示。
          這些欄位在私版是唯讀的 —— 要修改得到公版後台。
        </p>
      </div>

      {/* 色票 */}
      <div className="flex flex-wrap gap-6">
        <ColorField label="底色" value={bg} onChange={setBg} />
        <ColorField label="文字色" value={fg} onChange={setFg} />
      </div>

      {/* 對比度 */}
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          passesAA
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}
      >
        <span className="font-medium">對比度 {ratio.toFixed(2)}:1</span>
        {passesAA ? (
          <span className="ml-2">符合 WCAG AA（一般文字需 {WCAG_AA_NORMAL_TEXT}:1 以上）</span>
        ) : (
          <span className="ml-2">
            低於 WCAG AA 的 {WCAG_AA_NORMAL_TEXT}:1，表頭文字可能不易辨識。
            仍可儲存，但建議加深文字色或調淡底色。
          </span>
        )}
      </div>

      {/* 預覽 */}
      <div>
        <div className="mb-2 text-xs font-medium text-gray-500">預覽</div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Email', 'NUWA ID', '用戶名稱', '手機', '方案'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-medium whitespace-nowrap"
                      style={{ background: bg, color: fg }}
                    >
                      {h}
                    </th>
                  ))}
                  {['學員暱稱', 'MBTI'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">user@example.com</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap font-mono text-xs">42cc6958…</td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">小明</td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">0912-345-678</td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">premium</td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">阿明</td>
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">INTJ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 動作 */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saveState === 'saving'}
          className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {saveState === 'saving' ? '儲存中⋯' : '儲存'}
        </button>
        <button
          onClick={reset}
          disabled={!isDirty || saveState === 'saving'}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          回到預設色
        </button>
        {message && (
          <span
            className={`text-sm ${saveState === 'error' ? 'text-red-600' : 'text-gray-500'}`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded border border-gray-200 cursor-pointer bg-white p-0.5"
          aria-label={label}
        />
        <span className="font-mono text-sm text-gray-600 tabular-nums">{value}</span>
      </div>
    </div>
  );
}
