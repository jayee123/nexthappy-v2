-- supabase/migrations/010_disable_audit_log_rls.sql
--
-- Week 2 Session 2C hotfix：
-- Migration 008 建 admin_audit_logs 時跑了「Run and enable RLS」option、
-- Supabase 用 FORCE ROW LEVEL SECURITY、連 service_role 都被擋。
-- logAdminAction 從未成功寫 audit log（silent fail、code 42501）。
--
-- 解法：直接 disable RLS。
-- 安全性：admin_audit_logs 只透過 supabaseAdmin (service role) 在 /api/admin/* 寫入、
-- app layer 已用 requireAdmin middleware 嚴格保護、不需要 DB layer 第二道。
--
-- 此 migration 是 idempotent（已 disable 再跑無傷）。

ALTER TABLE admin_audit_logs DISABLE ROW LEVEL SECURITY;