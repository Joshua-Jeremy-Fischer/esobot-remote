import json
import logging
import traceback

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from config import PORT
from graph import WorkflowState, workflow

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="LangGraph Multi-Agent Service")


class WorkflowRequest(BaseModel):
    task: str


def _initial_state(task: str) -> WorkflowState:
    return WorkflowState(
        task=task,
        research="",
        code="",
        qa_feedback="",
        qa_passed=False,
        fix_iterations=0,
        final_output="",
        steps=[],
    )


@app.get("/health")
async def health():
    return {"ok": True, "service": "langchain-agent"}


@app.post("/workflow/run")
async def run_workflow(req: WorkflowRequest):
    task = req.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="task must not be empty")
    try:
        state = await workflow.ainvoke(_initial_state(task))
        return {
            "task":            state["task"],
            "final_output":    state["final_output"],
            "qa_passed":       state["qa_passed"],
            "qa_feedback":     state["qa_feedback"],
            "fix_iterations":  state["fix_iterations"],
            "steps":           state["steps"],
        }
    except Exception as e:
        logging.error("Workflow error: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e) or repr(e))


@app.get("/workflow/stream")
async def stream_workflow(task: str = Query(..., min_length=1)):
    """SSE endpoint — emits a JSON event after each agent node completes."""
    task = task.strip()

    async def event_generator():
        NODE_NAMES = {"researcher", "coder", "qa_reviewer", "fixer"}
        async for event in workflow.astream_events(_initial_state(task), version="v2"):
            kind = event.get("event")
            name = event.get("name")

            if kind == "on_chain_end" and name in NODE_NAMES:
                output = event.get("data", {}).get("output", {})
                yield {
                    "data": json.dumps({
                        "node":  name,
                        "steps": output.get("steps", []),
                    })
                }

            if kind == "on_chain_end" and name == "LangGraph":
                output = event.get("data", {}).get("output", {})
                yield {
                    "data": json.dumps({
                        "done":           True,
                        "final_output":   output.get("final_output", ""),
                        "qa_passed":      output.get("qa_passed", False),
                        "qa_feedback":    output.get("qa_feedback", ""),
                        "fix_iterations": output.get("fix_iterations", 0),
                        "steps":          output.get("steps", []),
                    })
                }

    return EventSourceResponse(event_generator())


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
