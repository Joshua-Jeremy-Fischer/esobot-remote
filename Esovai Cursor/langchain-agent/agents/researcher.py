from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import RESEARCHER_TOOLS
from config import (
    USE_NVIDIA, NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
)

SYSTEM_PROMPT = """You are a Research Agent. Given a software task, search the web \
for relevant documentation, libraries, APIs, and best practices.
Return a concise research summary that a coder can immediately act on.
Focus on: exact API names, required dependencies, code patterns, and gotchas.
Keep the summary under 800 words."""


def _make_llm() -> ChatOpenAI:
    if USE_NVIDIA:
        return ChatOpenAI(
            api_key=NVIDIA_API_KEY,
            base_url=NVIDIA_BASE_URL,
            model=NVIDIA_MODEL,
            temperature=0.2,
        )
    return ChatOpenAI(
        api_key="ollama",
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_MODEL,
        temperature=0.2,
    )


async def researcher_node(state: dict) -> dict:
    llm = _make_llm()
    agent = create_react_agent(llm, RESEARCHER_TOOLS, prompt=SYSTEM_PROMPT)
    result = await agent.ainvoke({"messages": [("user", state["task"])]})
    content = result["messages"][-1].content
    return {
        "research": content,
        "steps": [f"[Researcher] Done ({len(content)} chars)"],
    }
