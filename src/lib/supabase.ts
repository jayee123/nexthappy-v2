import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 前端用（只有 anon 權限）— 使用 happy schema 隔離
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'happy' },
});

// 後端用（有完整 service_role 權限，只在 API Routes 用）— 使用 happy schema 隔離
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'happy' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
