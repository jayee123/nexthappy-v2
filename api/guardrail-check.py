# 放置路徑：api/guardrail-check.py
#
# nexthappy 對話範疇防護，跑在 Vercel 的 Python Serverless Function 上
# （跟 Next.js 前台同一個 Vercel 專案、同一個網域，不用另外的服務）。
#
# 兩條獨立軸（見 nexthappy-config/rails.co + actions.py）：
#   套話風險（Prompt/Model Extraction，P1，商業 IP 防護主線）→ high / mid / low
#   主題相關性（P3，次要）→ relevant / off_topic
# 這支函式負責：把兩軸的分類結果換算成「要不要攔、攔的話回什麼話」，
# 其中套話中風險走反問升級階梯（第1次反問、第2次換句話反問、
# 第3次講白、第3次後仍繼續→升級成高風險直接拒答），對應
# roadmap/guardrail-plan.html §03 的設計。
#
# 升級階梯的計數器是記憶體內的簡易實作（跟 src/app/api/ai/chat/route.ts、
# consultant/route.ts 原有的 rateLimitMap 同樣取捨）：Vercel serverless
# 冷啟動會讓這份記憶重置，不保證跨冷啟動持久化。先用這個版本上線，
# 如果之後發現冷啟動太頻繁導致階梯形同虛設，再接 DB 存。
#
# 為什麼可以直接放進 Vercel 而不用另外找 Render：
# Vercel 的 Python Serverless Function 上限是 500MB（Node.js 上限才 250MB），
# NeMo Guardrails 實測打包約 277MB，在這個限制之下。真正跑起來後的
# 冷啟動速度、記憶體用量都還沒有在 Vercel 正式環境實測過，部署後務必
# 先手動打一次 /api/guardrail-check 確認真的能在時限內回應。

import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from nemoguardrails import LLMRails, RailsConfig

app = FastAPI()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "nexthappy-config")
SERVICE_SECRET = os.environ.get("GUARDRAIL_SERVICE_SECRET")

# 跟原本 service/main.py 一樣：啟動時載入一次，不要每個請求都重建。
# 在 Serverless 環境裡，這段會在「冷啟動」時跑一次，暖機後的請求會重複利用。
_config = RailsConfig.from_path(CONFIG_PATH)
_rails = LLMRails(_config)

OFF_TOPIC_MARKER = "GUARDRAIL_OFF_TOPIC"
EXTRACTION_HIGH_MARKER = "GUARDRAIL_EXTRACTION_HIGH"
EXTRACTION_MID_MARKER = "GUARDRAIL_EXTRACTION_MID"

OFF_TOPIC_REPLY = "這裡比較適合聊關係方面的事——你今天有沒有什麼想聊的？"

# 高風險（直接踩到）跟中風險第 3 次後仍繼續（被升級）共用這句——
# 兩者都是「直接拒答，不再解釋原因」，跟第 3 次「講白但不拒答」是兩種不同語氣
EXTRACTION_HIGH_REPLY = "這個我沒辦法回應，我們聊回你原本在意的事吧。"
# 中風險第 3 次：劃清界線但不是拒答，只講一次
EXTRACTION_BOUNDARY_REPLY = "這部分我沒辦法分享內部的規劃邏輯，但很樂意繼續陪你聊你的狀況。"

EXTRACTION_MID_DEFLECTIONS = [
    "這個問題有點跳出我們今天聊的範圍耶，你是比較想了解怎麼運作，還是有什麼卡住的地方？",
    "我們好像聊到比較偏『系統怎麼運作』的部分了——要不要先說說你最近遇到的狀況？",
]

# key: session_key（由呼叫端傳入，例如 "<userId>:chat"）；value: 連續中風險次數
_escalation_counters: dict[str, int] = {}


class CheckRequest(BaseModel):
    message: str
    session_key: Optional[str] = None


class CheckResponse(BaseModel):
    blocked: bool
    refusal_text: Optional[str] = None
    outcome: str


def _verify_auth(authorization: Optional[str]) -> None:
    if not SERVICE_SECRET:
        # 沒設密鑰 = 測試模式，不擋。正式環境請在 Vercel 專案設定裡加這個環境變數。
        return
    if authorization != f"Bearer {SERVICE_SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")


def _handle_extraction_mid(session_key: Optional[str]) -> tuple[str, str]:
    key = session_key or "_default"
    step = _escalation_counters.get(key, 0) + 1
    _escalation_counters[key] = step

    if step == 1:
        return EXTRACTION_MID_DEFLECTIONS[0], "extraction_mid_1"
    if step == 2:
        return EXTRACTION_MID_DEFLECTIONS[1], "extraction_mid_2"
    if step == 3:
        return EXTRACTION_BOUNDARY_REPLY, "extraction_mid_3"
    # 第 3 次後仍繼續 → 升級成高風險處理，不再反問或解釋
    return EXTRACTION_HIGH_REPLY, "extraction_mid_escalated"


@app.post("/api/guardrail-check")
async def check_message(
    req: CheckRequest,
    authorization: Optional[str] = Header(default=None),
) -> CheckResponse:
    _verify_auth(authorization)

    result = await _rails.generate_async(
        messages=[{"role": "user", "content": req.message}]
    )
    content = result.get("content", "") if isinstance(result, dict) else str(result)
    content = content.strip()

    key = req.session_key or "_default"

    if content.startswith(EXTRACTION_HIGH_MARKER):
        # 真的踩到高風險，不管之前中風險計數到哪，直接歸零重來
        _escalation_counters.pop(key, None)
        return CheckResponse(blocked=True, refusal_text=EXTRACTION_HIGH_REPLY, outcome="extraction_high")

    if content.startswith(EXTRACTION_MID_MARKER):
        refusal_text, outcome = _handle_extraction_mid(req.session_key)
        return CheckResponse(blocked=True, refusal_text=refusal_text, outcome=outcome)

    if content.startswith(OFF_TOPIC_MARKER):
        # 離題跟套話風險是獨立的兩軸，離題不影響套話計數器
        return CheckResponse(blocked=True, refusal_text=OFF_TOPIC_REPLY, outcome="off_topic")

    # 正常訊息：套話風險計數器歸零（講一句正常話就重置，不是無限累加）
    _escalation_counters.pop(key, None)
    return CheckResponse(blocked=False, outcome="relevant")


@app.get("/api/guardrail-check")
async def health() -> dict:
    return {"status": "ok"}
