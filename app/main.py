import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.job_agent import generate_job_post
from app.schemas import JobPostRequest, JobPostResponse

app = FastAPI(title="AI Job Posting Agent")
STATIC_DIR = Path(__file__).parent / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
def ui() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-job-post", response_model=JobPostResponse)
def generate(request: JobPostRequest) -> JobPostResponse:
    try:
        response = generate_job_post(request)
        _save_draft(request, response)
        return response
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc


def _save_draft(request: JobPostRequest, response: JobPostResponse) -> None:
    settings = get_settings()
    draft_id = uuid4().hex
    payload = {
        "id": draft_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_payload": request.model_dump(),
        "generated_payload": response.model_dump(),
    }
    path = Path(settings.draft_dir) / f"{draft_id}.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
