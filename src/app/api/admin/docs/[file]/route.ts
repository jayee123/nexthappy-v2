// 放置路徑：src/app/api/admin/docs/[file]/route.ts
//
// Week 5 Session 5D：Trade Secret 文件查看 API
//
// GET /api/admin/docs/spec          → 回 docs/v2.1-course-spec.md
// GET /api/admin/docs/build-context → 回 src/lib/ai/buildContext.ts + 解析 sections
//
// 安全：
//   - 嚴格 allowlist、不接受任意 path
//   - 寫 audit log（action: 'spec.view' / 'prompts.view'）
//   - 只 admin 可查

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { logAdminAction } from '@/lib/admin/auditLog';
import type { ApiResponse } from '@/types';

// ============================================================
// Allowlist：只允許這些 file id、不接受任意 path
// ============================================================

interface AllowedFile {
  relativePath: string;
  type: 'markdown' | 'typescript';
  auditAction: string;
}

const ALLOWED_FILES: Record<string, AllowedFile> = {
  'spec': {
    relativePath: 'docs/v2.1-course-spec.md',
    type: 'markdown',
    auditAction: 'spec.view',
  },
  'build-context': {
    relativePath: 'src/lib/ai/buildContext.ts',
    type: 'typescript',
    auditAction: 'prompts.view',
  },
};

// ============================================================
// Mode 分類：給每個 BLOC 標 Mode A / Mode B / 共用
// ============================================================

type SectionKind = 'modeA' | 'modeB' | 'shared';

const BLOC_KIND: Record<string, SectionKind> = {
  WEEK_STRUCTURE: 'modeA',
  BRAND_INTEGRITY_BLOC: 'shared',
  CROSS_LAYER_PRINCIPLES_BLOC: 'shared',
  TWO_LAYER_SEPARATION_BLOC: 'shared',
  MODE_A_LOCK_BLOC: 'modeA',
  MODE_B_LOCK_BLOC: 'modeB',
  LEAD_PROBE_SOP_BLOC: 'modeB',
  W2_DISCIPLINE_BLOC: 'shared',
  MBTI_BALANCE_BLOC: 'shared',
  GOLDEN_EXAMPLE_BLOC: 'modeB',
  MODE2_DISCIPLINE_BLOC: 'modeB',
  MODE2_DISCIPLINE_BLOC_REMINDER: 'modeB',
};

interface ParsedSection {
  id: string;
  name: string;
  kind: SectionKind | 'function' | 'comment';
  startLine: number;
  endLine: number;
  preview: string;       // 第一行（描述用）
  content: string;       // 整段 BLOC 內容（template literal 內容、不含 const xxx = ` 跟結尾 `）
  rawContent: string;    // 完整原始（含宣告）
}

/**
 * 解析 buildContext.ts、找出每個 BLOC constant 區塊。
 * 規則：找 `const XXX_BLOC = \`` 開始、`\`;` 結束。
 */
function parseTypeScriptSections(text: string): ParsedSection[] {
  const lines = text.split('\n');
  const sections: ParsedSection[] = [];

  // Regex: const XXX = `   (template literal start)
  const blocStart = /^(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*`/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(blocStart);
    if (!m) continue;
    const name = m[1];
    const startLine = i + 1; // 1-based 行號

    // 找結束（整行 trim 後以 ` 開頭、可選 method chain 結尾、可選 ;）
    // 例：`;  /  `  /  `.trim();  /  `.replace(/x/, '');
    // ^ anchor 避免誤抓下一個 BLOC 開頭的 'const XXX = `'
    let endLine = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim().match(/^`(\.\w+\([^)]*\))*\s*;?\s*$/)) {
        endLine = j + 1;
        break;
      }
    }

    const content = lines.slice(i + 1, endLine - 1).join('\n');
    const rawContent = lines.slice(i, endLine).join('\n');
    const previewLine = lines.slice(i + 1, i + 5).find(l => l.trim().length > 0) || '';

    sections.push({
      id: name.toLowerCase().replace(/_/g, '-'),
      name,
      kind: BLOC_KIND[name] || 'shared',
      startLine,
      endLine,
      preview: previewLine.trim().slice(0, 120),
      content,
      rawContent,
    });

    i = endLine - 1; // 跳到此 BLOC 結尾、繼續找下一個
  }

  return sections;
}

/**
 * 解析 markdown、抽 TOC（h2 + h3 標題）。
 */
interface MarkdownTocItem {
  level: 2 | 3;
  text: string;
  anchor: string;
  lineNumber: number;
}

function parseMarkdownToc(text: string): MarkdownTocItem[] {
  const lines = text.split('\n');
  const toc: MarkdownTocItem[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    // 跳過 code block 內容
    if (lines[i].startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const h2 = lines[i].match(/^##\s+(.+)$/);
    const h3 = lines[i].match(/^###\s+(.+)$/);
    if (h2) {
      const text = h2[1].trim();
      toc.push({
        level: 2,
        text,
        anchor: toAnchor(text),
        lineNumber: i + 1,
      });
    } else if (h3) {
      const text = h3[1].trim();
      toc.push({
        level: 3,
        text,
        anchor: toAnchor(text),
        lineNumber: i + 1,
      });
    }
  }

  return toc;
}

/**
 * 把標題轉成 anchor slug（react-markdown rehype-slug 用的算法、簡化版）
 */
function toAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, '') // 保留英數、中文、空格、hyphen
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================================
// GET handler
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { file: string } }
) {
  const { error: authError, adminUser } = await requireAdmin(request);
  if (authError) return authError;

  const fileId = params.file;
  const allowed = ALLOWED_FILES[fileId];
  if (!allowed) {
    return NextResponse.json<ApiResponse>(
      { data: null, error: '不允許的檔案 ID', timestamp: new Date().toISOString() },
      { status: 400 }
    );
  }

  try {
    // 讀檔（process.cwd() 是專案根、works on Vercel）
    const fullPath = path.join(process.cwd(), allowed.relativePath);
    const content = await readFile(fullPath, 'utf-8');

    // 解析（按檔型）
    let sections: ParsedSection[] | null = null;
    let toc: MarkdownTocItem[] | null = null;
    if (allowed.type === 'typescript') {
      sections = parseTypeScriptSections(content);
    } else if (allowed.type === 'markdown') {
      toc = parseMarkdownToc(content);
    }

    // 寫 audit log（不阻塞 response）
    if (adminUser) {
      logAdminAction({
        request,
        adminUserId: adminUser.id,
        action: allowed.auditAction,
        targetType: 'document',
        targetId: fileId,
      }).catch(err => console.error('[docs view audit] failed:', err));
    }

    return NextResponse.json<ApiResponse>({
      data: {
        file_id: fileId,
        relative_path: allowed.relativePath,
        type: allowed.type,
        content,
        sections,
        toc,
        line_count: content.split('\n').length,
        char_count: content.length,
      },
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[GET /api/admin/docs/${fileId}] read failed:`, errMsg);
    return NextResponse.json<ApiResponse>(
      {
        data: null,
        // 暴露錯誤細節給 admin（admin only、不影響 user）、方便 debug
        error: `無法讀取檔案：${errMsg}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
