import { redirect } from 'next/navigation';
import { MARKET_REGISTER_URL } from '@/lib/market';

// #3a：私版停用獨立註冊，一律導向公版（Market）註冊。
// 使用者在公版註冊（含邀請碼）後，從公版「進去使用 App」以 SSO 進來，/sso 自動建立/連結私版帳號。
// 本頁保留為舊連結（書籤 / LINE 群訊息 / /welcome 的 next 預設值）的轉接點。
export default function RegisterPage() {
  redirect(MARKET_REGISTER_URL);
}
