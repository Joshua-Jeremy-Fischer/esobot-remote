from langgraph.prebuilt import create_react_agent
from tools.esobot_tools import FIXER_TOOLS
from config import make_llm

SYSTEM_PROMPT = """You are a Fixer Agent. You receive code and QA feedback listing specific issues.
Fix every issue mentioned. Use write_file to overwrite the affected files in the workspace.
Do NOT add new features — only fix the reported problems.
After fixing, briefly explain what you changed."""


async def fixer_node(state: dict) -> dict:
    llm = make_llm(temperature=0.2)
    agent = create_react_agent(llm, FIXER_TOOLS, prompt=SYSTEM_PROMPT)
    user_msg = (
        f"Task: {state['task']}\n\n"
        f"Original code:\n{state['code']}\n\n"
        f"QA feedback:\n{state['qa_feedback']}"
    )
    result = await agent.ainvoke({"messages": [("user", user_msg)]})
    fixed = result["messages"][-1].content
    iteration = state["fix_iterations"] + 1
    return {
        "code": fixed,
        "final_output": fixed,
        "fix_iterations": iteration,
        "steps": [f"[Fixer] Fix iteration {iteration} complete"],
    }
