-- =============================================
-- Supabase 函數
-- 在 SQL Editor 執行 schema.sql 後執行此檔案
-- =============================================

-- 新增積分函數（原子操作，防止競爭條件）
CREATE OR REPLACE FUNCTION add_journey_points(p_journey_id UUID, p_points INT)
RETURNS VOID AS $$
BEGIN
  UPDATE journeys
  SET total_points = total_points + p_points,
      updated_at = NOW()
  WHERE id = p_journey_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) - 選擇性啟用
-- 目前使用 service_role key 直接操作，不需要 RLS
-- 如果未來要用 anon key 直接讀取，請啟用以下設定

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_memories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
