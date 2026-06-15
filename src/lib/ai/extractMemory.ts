import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../supabase';
import type { ChatMessage } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface DailyMemoryExtract {
  emotion_note: string;
  task_result: string;
  partner_obs: string;
  key_insight: string;
  follow_up: string;
}

// 每日記憶萃取（晚間複盤後觸發）
export async function extractDailyMemory(
  journeyId: string,
  dayNumber: number,
  conversation: ChatMessage[]
): Promise<void> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      system: `請從以下對話中萃取重點，以 JSON 格式回覆，不要有其他文字：
{
  "emotion_note": "一句話描述今天學員的情緒狀態（例：今天情緒偏積極，有嘗試新方法）",
  "task_result": "任務執行情況（完成/部分完成/未完成 + 簡述）",
  "partner_obs": "對方今天的反應或觀察（學員描述的）",
  "key_insight": "學員今天最重要的一個洞察或成長",
  "follow_up": "明天需要追蹤的一件事（可留空）"
}`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(conversation.slice(-20)), // 只取最近20條訊息
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    let memory: DailyMemoryExtract;
    try {
      memory = JSON.parse(text);
    } catch {
      // JSON 解析失敗，使用預設值
      memory = {
        emotion_note: '今日有完成練習',
        task_result: '完成',
        partner_obs: '未記錄',
        key_insight: '持續練習中',
        follow_up: '',
      };
    }

    await supabaseAdmin
      .from('daily_memories')
      .upsert(
        {
          journey_id: journeyId,
          day_number: dayNumber,
          ...memory,
        },
        { onConflict: 'journey_id,day_number' }
      );
  } catch (error) {
    console.error('Memory extraction failed:', error);
    // 不拋出錯誤，讓主流程繼續
  }
}
