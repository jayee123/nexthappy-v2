# 放置路徑：api/guardrail-check.py
#
# nexthappy 對話範疇防護，跑在 Vercel 的 Python Serverless Function 上
# （跟 Next.js 前台同一個 Vercel 專案、同一個網域，不用另外的服務）。
#
# 只做一件事：收一則使用者訊息，回傳「要不要攔下」的布林值。
# 不負責生成正式回覆——那是 src/app/api/ai/chat/route.ts 的 OpenAI 呼叫在做的事，
# 這支函式只是前面多一道關卡。
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

BLOCKED_MARKER = "GUARDRAIL_BLOCKED"


class CheckRequest(BaseModel):
    message: str


class CheckResponse(BaseModel):
    blocked: bool


def _verify_auth(authorization: Optional[str]) -> None:
    if not SERVICE_SECRET:
        # 沒設密鑰 = 測試模式，不擋。正式環境請在 Vercel 專案設定裡加這個環境變數。
        return
    if authorization != f"Bearer {SERVICE_SECRET}":
        raise HTTPException(status_code=401, detail="unauthorized")


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
    blocked = content.strip().startswith(BLOCKED_MARKER)
    return CheckResponse(blocked=blocked)


@app.get("/api/guardrail-check")
async def health() -> dict:
    return {"status": "ok"}
