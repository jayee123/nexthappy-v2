/**
 * 後台通用設定（happy.system_params）的讀寫。
 *
 * 見 supabase/migrations/016_system_params.sql。
 * 值一律是 string —— 型別與格式的驗證由各自的寫入端 API 負責。
 */
import { supabaseAdmin } from '@/lib/supabase';

/**
 * 批次讀取設定值。
 *
 * 回傳的 Map 只含「DB 裡真的有」的鍵 —— 呼叫端要自己準備預設值。
 * 這是刻意的：預設值屬於功能本身（跟著程式碼走），不該由這一層猜。
 *
 * DB 查詢失敗時回空 Map 而非 throw：設定讀不到只該讓畫面退回預設樣式，
 * 不該讓整個後台掛掉。錯誤仍會記進 server log。
 */
export async function getSystemParams(keys: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (keys.length === 0) return result;

  const { data, error } = await supabaseAdmin
    .from('system_params')
    .select('key, value')
    .in('key', keys);

  if (error) {
    console.error('[systemParams] 讀取失敗，退回預設值：', error.message);
    return result;
  }

  for (const row of data ?? []) {
    if (row.value !== null) result.set(row.key, row.value);
  }
  return result;
}

/**
 * 批次寫入設定值。呼叫端必須先驗證過格式。
 *
 * 用 upsert 而非 update：初始列雖然由 migration 建立，但若有人手動刪過，
 * update 會靜默影響 0 列、管理員以為存好了其實沒有。
 */
export async function setSystemParams(
  params: { key: string; value: string }[],
  updatedBy: string
): Promise<{ error: string | null }> {
  if (params.length === 0) return { error: null };

  const { error } = await supabaseAdmin.from('system_params').upsert(
    params.map(p => ({
      key: p.key,
      value: p.value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'key' }
  );

  if (error) {
    console.error('[systemParams] 寫入失敗：', error.message);
    return { error: error.message };
  }
  return { error: null };
}
