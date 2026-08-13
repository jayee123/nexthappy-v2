/**
 * src/lib/market/client.ts
 *
 * 讀公版（NUWA Market）資料用的 Supabase client。
 *
 * 兩邊在同一個 Postgres：公版在 public schema、私版在 happy schema。
 * 私版的 supabaseAdmin 綁死 happy，所以另開一個指向 public 的 service-role client。
 * 只讀、不寫 —— 公版資料的真值由公版自己維護。
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let marketClient: SupabaseClient | null = null;

/**
 * 延遲建立：讓同目錄的純函式在沒有 env var 的環境（單元測試）也能被 import。
 */
export function getMarketClient(): SupabaseClient {
  if (!marketClient) {
    marketClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: { schema: 'public' },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return marketClient;
}
