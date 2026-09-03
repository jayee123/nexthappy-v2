// 放置路徑：src/lib/ai/openai.ts
//
// 統一的 OpenAI Chat Completions 呼叫封裝（用 fetch 直打 REST API，不加 SDK 依賴——
// 跟現有 src/app/api/realtime/session/route.ts 呼叫 OpenAI 的方式一致）。
//
// 取代原本的 Anthropic SDK：
//   - streamOpenAIChat()  給串流對話用（/api/ai/chat、/api/ai/consultant）
//   - callOpenAIChat()    給一次性、非串流用途（autoTitle、extractMemory）

export interface OpenAIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OpenAIUsage {
  inputTokens: number;
  outputTokens: number;
}

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

function authHeaders() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 未設定');
  }
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * 串流版本。yield 文字片段（{text}）與最後的 usage（{usage}）。
 *
 * 用法對齊原本 Anthropic stream 的 for-await 慣例：
 *   for await (const chunk of streamOpenAIChat({...})) {
 *     if (chunk.text) fullResponse += chunk.text;
 *     if (chunk.usage) usage = chunk.usage;
 *   }
 */
export async function* streamOpenAIChat(opts: {
  model: string;
  system: string;
  messages: OpenAIChatMessage[];
  maxTokens: number;
}): AsyncGenerator<{ text?: string; usage?: OpenAIUsage }> {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: opts.model,
      max_completion_tokens: opts.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // 留最後不完整的一行給下一輪

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield { text: delta };
        if (parsed.usage) {
          yield {
            usage: {
              inputTokens: parsed.usage.prompt_tokens ?? 0,
              outputTokens: parsed.usage.completion_tokens ?? 0,
            },
          };
        }
      } catch {
        // SSE 偶爾會切到不完整的 chunk、忽略即可（下一輪 buffer 會補完整）
      }
    }
  }
}

/**
 * 非串流版本，給一次性用途（autoTitle 生標題、extractMemory 萃取 JSON）。
 * 回傳 assistant 訊息的純文字內容。
 */
export async function callOpenAIChat(opts: {
  model: string;
  system?: string;
  messages: OpenAIChatMessage[];
  maxTokens: number;
  jsonMode?: boolean;
}): Promise<string> {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: opts.model,
      max_completion_tokens: opts.maxTokens,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        ...opts.messages,
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
