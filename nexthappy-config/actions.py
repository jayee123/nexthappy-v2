# 兩軸分類的自訂 action：NeMo 內建的 self_check_input 只能回 Yes/No，
# 套話風險需要 high/mid/low 三級，所以這兩個 action 直接重用
# library 的 run_self_check_task 工具函式（跟內建 self_check_input 用同一套），
# 但自己解析 LLM 的原始回覆文字，而不是套用內建的二元 is_content_safe parser。

from typing import Dict, Optional

from nemoguardrails import RailsConfig
from nemoguardrails.actions.actions import action
from nemoguardrails.library.self_check.utils import run_self_check_task
from nemoguardrails.llm.taskmanager import LLMTaskManager
from nemoguardrails.types import LLMModel


@action(is_system_action=True)
async def self_check_topic(
    llms: Dict[str, LLMModel],
    llm_task_manager: LLMTaskManager,
    context: Optional[dict] = None,
    llm: Optional[LLMModel] = None,
    config: Optional[RailsConfig] = None,
    **kwargs,
) -> str:
    context = context or {}
    user_input = context.get("user_message")
    if not user_input:
        return "relevant"

    is_on_topic, _ = await run_self_check_task(
        task="self_check_topic",
        prompt_context={"user_input": user_input},
        llms=llms,
        default_task="self_check_topic",
        main_llm=llm,
        llm_task_manager=llm_task_manager,
        lowest_temperature=config.lowest_temperature if config is not None else 0.0,
    )
    # self_check_topic 的 prompt 問的是「這則訊息完全離題嗎？」，
    # Yes = 離題 = is_content_safe 解析成 unsafe（False）
    return "relevant" if is_on_topic else "off_topic"


@action(is_system_action=True)
async def self_check_extraction(
    llms: Dict[str, LLMModel],
    llm_task_manager: LLMTaskManager,
    context: Optional[dict] = None,
    llm: Optional[LLMModel] = None,
    config: Optional[RailsConfig] = None,
    **kwargs,
) -> str:
    context = context or {}
    user_input = context.get("user_message")
    if not user_input:
        return "low"

    # 丟掉 run_self_check_task 回傳的二元 is_safe，自己解析原始文字拿三級結果
    _, response = await run_self_check_task(
        task="self_check_extraction",
        prompt_context={"user_input": user_input},
        llms=llms,
        default_task="self_check_extraction",
        main_llm=llm,
        llm_task_manager=llm_task_manager,
        lowest_temperature=config.lowest_temperature if config is not None else 0.0,
    )
    text = response.strip().lower()
    if "high" in text:
        return "high"
    if "mid" in text:
        return "mid"
    return "low"
