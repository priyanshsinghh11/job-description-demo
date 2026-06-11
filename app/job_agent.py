import json
import re
from typing import Any

from groq import Groq

from app.config import get_settings
from app.schemas import JobPostRequest, JobPostResponse


SYSTEM_PROMPT = """\
You are AJAIA's job description strategist. Generate polished, production-ready job postings
for AJAIA from a small amount of user input.

## Fixed AJAIA context

AJAIA is an AI consultancy and product studio helping organizations move from AI experiments
to real results. AJAIA operates across four core pillars: AI Strategy and Advisory, AI
Engineering and Automation, Workforce Training and Enablement, and Custom Product
Development. In addition to client services, AJAIA builds proprietary AI products, copilots,
and vertical solutions that solve high-value industry problems. Its operating model combines
deep technical execution with practical change management, enabling enterprises to deploy
secure, compliant, and high-impact AI solutions that drive measurable operational value.
Mission: Help organizations win the AI moment.

## AI experience scale

The user provides AI Experience from 1 to 5:
- 1: Curious beginner. Basic AI awareness is enough.
- 2: Comfortable user. Can use AI tools for everyday productivity.
- 3: Applied practitioner. Can use AI in role-specific workflows and evaluate outputs.
- 4: Advanced builder/operator. Can design AI-assisted workflows, prompts, and evaluation loops.
- 5: Expert. Can lead AI-native work, define best practices, and guide others.

## Input model

The hiring manager supplies only five inputs: Job Title, a short Role Description, Job
Location, Compensation, and an AI Experience level. Everything else in the posting is
written by you. Treat the manager's inputs as the seed: keep every concrete fact they
contain (numbers, named tools, location, compensation figures), then generate the full,
very detailed posting per the section content rules below. Generate the "About the
Company", "Why Join AJAIA", and Mission wording yourself from the fixed AJAIA context
above.

## Section content rules

Position Overview: write 2-3 substantial paragraphs (4-5 sentences of roughly 40-50
words each in total) built from the manager's role description. Cover what the role will
build and own, the scope across the product or delivery lifecycle, and AJAIA's
AI-forward expectation: every role at AJAIA uses AI in daily workflows across research,
ideation, drafting, quality checks, and delivery acceleration - AI usage is a core
execution requirement, not optional tooling.

Primary Responsibilities: generate 8-10 detailed "- " bullets from the role description
and your knowledge of what this role does day to day, each a full action-oriented
sentence (design, build, collaborate, own, troubleshoot, iterate, establish best
practices).

Job Requirements: generate 8-12 detailed "- " bullets yourself from your knowledge of
what this specific role needs: experience expectations, ownership and self-starter
mindset, stakeholder collaboration, strong communication, ability to drive projects in
ambiguous environments, relevant portfolio or shipped-work expectations, and AI-native
working habits calibrated to the requested AI experience level.

Technical Requirements: generate the complete set of technologies and skills that are
standard and compulsory for this role, including anything named in the role description
(for example, for a full stack AI role: JavaScript/TypeScript, a modern frontend
framework, Python or Node backend, REST APIs, relational and NoSQL databases, Git, cloud
deployment, CI/CD, and working with LLM APIs). Write 8-12 detailed "- " bullets, each
specific enough to screen candidates against.

Schedule and Location: build 1-2 clean lines from the manager's job location. Keep the
location facts exactly as given and add a reasonable standard working-schedule line for
the role (for example, expected time-zone alignment for remote roles). Do not invent
oddly specific constraints.

Benefits: the manager does not supply benefits - include a "Benefits" subheading under
"Compensation and Benefits" with 3-5 sensible standard "- " bullets (competitive base
plus performance incentives, remote or flexible work, professional development, paid
time off). Do not invent unusual or legally specific benefits.

## Compensation formatting

When the user message includes a "Compensation breakdown" block, copy those "- " bullet
lines exactly as given under the "Compensation" subheading - do not recalculate,
re-convert, or alter any figure in them. If no breakdown block is provided, write
exactly two "- " bullet lines instead:
- Compensation: <the manager's compensation exactly as given>
- Final compensation depends on experience, portfolio strength, and demonstrated performance.

## Output requirements

Generate exactly the requested number of variants. Each variant must have a different job
title and slightly adjusted framing, but the body must stay aligned to the same core role and
build on the manager's supplied content, expanded per the section content rules. Follow the
compensation formatting rules above, keeping the manager's figures as the basis. Do not
invent unrelated company facts, legal details, or assessment content. Start every line at column zero with no leading indentation
or extra leading whitespace. Write a complete, well-structured post for each variant; do not
pad with filler.

Each formatted job post must be a single flowing document, structured like a polished PDF
job posting. The first line is the job title alone (do not write the word "Title" and do not
repeat the job title twice). Then use these section headings, each on its own line, in this
order:
About the Company
Position Overview
Primary Responsibilities
Job Requirements
Schedule and Location
Technical Requirements
Compensation and Benefits
Why Join AJAIA

Under each list-style section (Primary Responsibilities, Job Requirements, Technical
Requirements), write each item on its own line starting with "- ". Narrative sections
(About the Company, Position Overview, Why Join AJAIA) should be short paragraphs, not
bullets.

Under "Compensation and Benefits", include a "Compensation" subheading line followed by
"- " bullet lines built from the manager's compensation input per the compensation
formatting rules, then a "Benefits" subheading with the standard benefits bullets.

Every role should be written as AI-forward. The AI experience level should influence the
strictness of the Job Requirements / Technical Requirements and the wording of Position
Overview, but should not create a separate assessment or test.

Return ONLY valid JSON matching the requested schema. No markdown outside JSON.\
"""


MAX_VARIANTS_PER_CALL = 3

USD_TO_INR = 86
USD_TO_PKR = 280


def _fmt_amount(value: float) -> str:
    return f"{int(round(value)):,}"


def _fmt_amount_range(low: float, high: float, rate: float = 1.0) -> str:
    low_value, high_value = low * rate, high * rate
    if abs(high_value - low_value) < 1:
        return _fmt_amount(low_value)
    return f"{_fmt_amount(low_value)}-{_fmt_amount(high_value)}"


def _build_compensation_block(text: str) -> str | None:
    """Build the USD/INR/PKR breakdown from the manager's input, keeping the
    figures and pay period exactly as entered (no annualizing). Only the
    currency conversions are computed. Returns None when no numbers found."""
    numbers = [float(n.replace(",", "")) for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)]
    if not numbers:
        return None

    lower_text = text.lower()
    if re.search(r"/\s*(hour|hr)\b|hourly|per hour", lower_text):
        period, base_label = "hourly", "Base rate"
    elif re.search(r"/\s*(month|mo)\b|monthly|per month", lower_text):
        period, base_label = "monthly", "Base salary"
    else:
        period, base_label = "yearly", "Base salary"

    low, high = min(numbers), max(numbers)
    bonus_high = max(round(high * 0.25 / 10) * 10, 10)
    total_high = high + bonus_high
    lines = [
        f"- {base_label} ({period}): USD {_fmt_amount_range(low, high)} "
        f"(INR {_fmt_amount_range(low, high, USD_TO_INR)} / "
        f"PKR {_fmt_amount_range(low, high, USD_TO_PKR)})",
        f"- Performance bonus ({period}): USD 0-{_fmt_amount(bonus_high)} "
        f"(INR 0-{_fmt_amount(bonus_high * USD_TO_INR)} / "
        f"PKR 0-{_fmt_amount(bonus_high * USD_TO_PKR)})",
        f"- Total cash compensation ({period}): USD {_fmt_amount_range(low, total_high)} "
        f"(INR {_fmt_amount_range(low, total_high, USD_TO_INR)} / "
        f"PKR {_fmt_amount_range(low, total_high, USD_TO_PKR)})",
        "- Salary and total compensation depend on experience, portfolio strength, "
        "and demonstrated performance.",
    ]
    return "\n".join(lines)

DEFAULT_COMPANY_CONTEXT = (
    "AJAIA is an AI consultancy and product studio helping organizations move from AI "
    "experiments to real results across four pillars: AI Strategy and Advisory, AI "
    "Engineering and Automation, Workforce Training and Enablement, and Custom Product "
    "Development. Mission: Help organizations win the AI moment."
)


def generate_job_post(request: JobPostRequest) -> JobPostResponse:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is missing. Add it to .env before generating.")

    client = Groq(api_key=settings.groq_api_key)

    variants: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    company_context = ""
    max_calls = (request.variant_count // MAX_VARIANTS_PER_CALL) + 3

    for _ in range(max_calls):
        missing = request.variant_count - len(variants)
        if missing <= 0:
            break
        batch_size = min(MAX_VARIANTS_PER_CALL, missing)
        payload = _request_payload(client, settings, request, batch_size, sorted(seen_titles))
        if not company_context:
            company_context = str(payload.get("company_context") or "")
        for variant in payload.get("variants") or []:
            if not isinstance(variant, dict):
                continue
            title = str(variant.get("job_title") or "").strip()
            if not title or title.lower() in seen_titles:
                continue
            seen_titles.add(title.lower())
            variants.append(variant)
            if len(variants) >= request.variant_count:
                break

    if len(variants) < request.variant_count:
        raise RuntimeError(
            f"Expected {request.variant_count} job variants, got {len(variants)}."
        )

    return JobPostResponse.model_validate(
        {
            "company_context": company_context or DEFAULT_COMPANY_CONTEXT,
            "variants": variants,
            "seo_titles": [variant["job_title"] for variant in variants],
        }
    )


def _request_payload(
    client: Groq,
    settings: Any,
    request: JobPostRequest,
    count: int,
    exclude_titles: list[str],
) -> dict[str, Any]:
    completion = client.chat.completions.create(
        model=settings.groq_model,
        temperature=0.35,
        max_tokens=settings.groq_max_completion_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(request, count, exclude_titles)},
        ],
    )
    content = completion.choices[0].message.content or "{}"
    try:
        return _parse_json(content)
    except json.JSONDecodeError:
        return {}


def _build_user_prompt(
    request: JobPostRequest, count: int, exclude_titles: list[str]
) -> str:
    schema_hint = {
        "company_context": "string (2-3 sentence AJAIA summary)",
        "variants": [
            {
                "job_title": "string",
                "formatted_job_post": "string - the complete job post document",
                "job_description": {
                    "title": "string",
                    "summary": "2-3 sentence role summary string",
                    "compensation": "one-line compensation summary string",
                },
                "meta_description": "150-160 character string",
            }
        ],
    }

    parts = [
        f"Job Title: {request.job_title}",
        f"Role Description: {request.description}",
        f"Job Location: {request.job_location}",
        f"Compensation: {request.compensation}",
        f"AI Experience Level: {request.ai_experience} out of 5",
        f"Variant Count: {count}",
    ]

    comp_block = _build_compensation_block(request.compensation)
    comp_section = ""
    if comp_block:
        comp_section = (
            "\n\nCompensation breakdown - copy these lines exactly under the "
            "Compensation subheading:\n" + comp_block
        )

    exclusion = ""
    if exclude_titles:
        exclusion = (
            "\n\nThese job titles are already used by other variants; do not repeat them "
            "and make the new titles clearly different:\n"
            + "\n".join(f"- {title}" for title in exclude_titles)
        )

    return (
        "Generate AJAIA job posting variants based on this manager input:\n\n"
        + "\n".join(parts)
        + comp_section
        + exclusion
        + "\n\n"
        "Create exactly "
        f"{count} variants. Keep the core content consistent across variants, "
        "but vary the title, emphasis, and wording enough that each option is useful. "
        "Generate the full, very detailed posting from the short inputs above per the section "
        "content rules: Position Overview, Primary Responsibilities, Job Requirements, "
        "Technical Requirements, Schedule and Location, and Benefits are all written by you, "
        "keeping every concrete fact the manager provided. Format compensation per the "
        "compensation formatting rules.\n\n"
        "The job_description object is short metadata for a summary table - keep it brief; "
        "all detailed content belongs in formatted_job_post.\n\n"
        "Return valid JSON matching this schema:\n"
        f"{json.dumps(schema_hint, indent=2)}"
    )


def _parse_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1:
            raise
        return json.loads(content[start : end + 1])
