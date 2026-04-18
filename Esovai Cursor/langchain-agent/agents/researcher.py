from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import RESEARCHER_TOOLS
from config import make_llm

SYSTEM_PROMPT = """You are a Research Agent. Given a software task, search the web \
for relevant documentation, libraries, APIs, and best practices.
Return a concise research summary that a coder can immediately act on.
Focus on: exact API names, required dependencies, code patterns, and gotchas.
Keep the summary under 800 words."""


async def researcher_node(state: dict) -> dict:
    llm = make_llm(temperature=0.2)
    agent = create_react_agent(llm, RESEARCHER_TOOLS, prompt=SYSTEM_PROMPT)
    result = await agent.ainvoke({"messages": [("user", state["task"])]})
    content = result["messages"][-1].content
    return {
        "research": content,
        "steps": [f"[Researcher] Done ({len(content)} chars)"],
    }
