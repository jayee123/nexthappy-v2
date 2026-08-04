import { redirect } from 'next/navigation';

// #3a：私版停用獨立註冊，一律導向公版（Market）註冊。
// 使用者在公版註冊（含邀請碼）後，從公版「進去使用 App」以 SSO 進來，/sso 自動建立/連結私版帳號。
export default function RegisterPage() {
  redirect('https://next.nuwa.chg2asc.com/register');
}
