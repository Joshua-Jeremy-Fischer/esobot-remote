from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import CODER_TOOLS
from config import (
    USE_NVIDIA, NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
)

SYSTEM_PROMPT = """You are a Coder Agent. You receive a task description and research context.
Write clean, working code. Use write_file to save your files to the workspace.
Always include: error handling, type annotations where appropriate, brief inline comments.
Do not over-engineer — write exactly what the task requires."""


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


async def coder_node(state: dict) -> dict:
    llm = _make_llm()
    agent = create_react_agent(llm, CODER_TOOLS, prompt=SYSTEM_PROMPT)
    user_msg = f"Task: {state['task']}\n\nResearch:\n{state['research']}"
    result = await agent.ainvoke({"messages": [("user", user_msg)]})
    content = result["messages"][-1].content
    return {
        "code": content,
        "final_output": content,
        "steps": ["[Coder] Code written"],
    }
