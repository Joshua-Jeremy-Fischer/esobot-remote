from typing import Annotated, Literal, TypedDict

from langgraph.graph import END, StateGraph

from agents.coder import coder_node
from agents.fixer import fixer_node
from agents.qa_reviewer import qa_reviewer_node
from agents.researcher import researcher_node
from config import MAX_FIX_ITERATIONS


class WorkflowState(TypedDict):
    task: str
    research: str
    code: str
    qa_feedback: str
    qa_passed: bool
    fix_iterations: int
    final_output: str
    steps: Annotated[list[str], lambda a, b: a + b]


def route_after_qa(state: WorkflowState) -> Literal["fixer", "__end__"]:
    if state["qa_passed"]:
        return "__end__"
    if state["fix_iterations"] >= MAX_FIX_ITERATIONS:
        return "__end__"
    return "fixer"


def build_graph():
    g = StateGraph(WorkflowState)

    g.add_node("researcher", researcher_node)
    g.add_node("coder", coder_node)
    g.add_node("qa_reviewer", qa_reviewer_node)
    g.add_node("fixer", fixer_node)

    g.set_entry_point("researcher")
    g.add_edge("researcher", "coder")
    g.add_edge("coder", "qa_reviewer")
    g.add_conditional_edges(
        "qa_reviewer",
        route_after_qa,
        {"fixer": "fixer", "__end__": END},
    )
    g.add_edge("fixer", "qa_reviewer")  # loop back after each fix

    return g.compile()


workflow = build_graph()
