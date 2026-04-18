from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import CODER_TOOLS
from config import make_llm

SYSTEM_PROMPT = """You are a Coder Agent. You receive a task description and research context.
Write clean, working code. Use write_file to save your files to the workspace.
Always include: error handling, type annotations where appropriate, brief inline comments.
Do not over-engineer — write exactly what the task requires."""


async def coder_node(state: dict) -> dict:
    llm = make_llm(temperature=0.2)
    agent = create_react_agent(llm, CODER_TOOLS, prompt=SYSTEM_PROMPT)
    user_msg = f"Task: {state['task']}\n\nResearch:\n{state['research']}"
    result = await agent.ainvoke({"messages": [("user", user_msg)]})
    content = result["messages"][-1].content
    return {
        "code": content,
        "final_output": content,
        "steps": ["[Coder] Code written"],
    }
