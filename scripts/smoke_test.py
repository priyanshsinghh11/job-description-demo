import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def request_json(url: str, method: str = "GET", payload: dict | None = None) -> dict | list:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=body, headers=headers, method=method)
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def request_text(url: str) -> str:
    with urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test the AI Job Posting Agent API.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--generate", action="store_true", help="Also test Groq generation.")
    args = parser.parse_args()

    try:
        health = request_json(f"{args.base_url}/health")
        assert health == {"status": "ok"}
        print("[ok] /health")

        html = request_text(f"{args.base_url}/")
        assert "AI Job Posting Agent" in html
        assert "/static/app.js" in html
        print("[ok] / UI")

        if args.generate:
            payload = {
                "role": "AI Trainer",
                "experience": "2+ years",
                "description": "We're an AI consultancy looking for someone to evaluate AI responses and write high quality prompts.",
            }
            generated = request_json(
                f"{args.base_url}/generate-job-post",
                method="POST",
                payload=payload,
            )
            assert "job_description" in generated
            assert "formatted_job_post" in generated
            print("[ok] /generate-job-post")

    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"[fail] HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise SystemExit(f"[fail] Cannot reach {args.base_url}: {exc.reason}") from exc


if __name__ == "__main__":
    main()
