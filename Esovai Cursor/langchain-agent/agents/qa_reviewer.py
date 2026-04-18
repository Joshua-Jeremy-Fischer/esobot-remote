import json
import re
from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import QA_TOOLS
from config import make_llm

SYSTEM_PROMPT = """You are a QA Reviewer Agent. Review the provided code for:
1. Logic errors and bugs
2. Security vulnerabilities (injection, hardcoded secrets, unsafe eval/exec)
3. Missing error handling
4. Code style and maintainability issues

Respond with valid JSON only — no markdown, no extra text, no <think> tags:
{"passed": true/false, "issues": ["issue1", "issue2"], "summary": "one-line verdict"}

If no critical issues found: passed=true and issues=[]."""


def _extract_json(raw: str) -> dict | None:
    """Strip <think>…</think> blocks, then find the last valid JSON object."""
    # Remove DeepSeek/Qwen think blocks before scanning for JSON
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # Find all {...} candidates and try them last-to-first (most likely the answer is last)
    for match in reversed(list(re.finditer(r"\{[^{}]*\}", cleaned, re.DOTALL))):
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            continue

    # Fallback: try the full cleaned string
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


async def qa_reviewer_node(state: dict) -> dict:
    llm = make_llm(temperature=0.1)
    agent = create_react_agent(llm, QA_TOOLS, prompt=SYSTEM_PROMPT)
    user_msg = f"Task: {state['task']}\n\nCode to review:\n{state['code']}"
    result = await agent.ainvoke({"messages": [("user", user_msg)]})
    raw = result["messages"][-1].content

    parsed = _extract_json(raw)
    if parsed:
        passed = bool(parsed.get("passed", False))
        feedback = parsed.get("summary", str(parsed))
    else:
        # Could not parse JSON at all — fail safe, flag for fixer
        passed = False
        feedback = raw[:300]

    return {
        "qa_feedback": feedback,
        "qa_passed": passed,
        "steps": [f"[QA] {'PASSED' if passed else 'FAILED'} — {feedback[:100]}"],
    }
