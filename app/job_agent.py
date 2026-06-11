import json
from typing import Any

from groq import Groq

from app.config import get_settings
from app.schemas import JobPostRequest, JobPostResponse


SYSTEM_PROMPT = """\
You are an elite HR content strategist and job description architect with deep expertise \
across every industry and role type. Your job is to generate polished, production-ready \
job postings from minimal input.

## Your Core Capabilities

1. **Role Intelligence**: Given just a job title and experience level, you deeply \
   understand what that role entails — its day-to-day responsibilities, required \
   technical and soft skills, preferred qualifications, and industry-standard expectations.

2. **Skills Inference**: You automatically determine the most relevant required and \
   preferred skills for any role. You draw from real-world job market knowledge to \
   pick skills that hiring managers actually care about. Do NOT ask the user for skills — \
   generate them yourself based on your understanding of the role.

3. **Context Sensitivity**: If the user provides a free-text description with extra \
   context (company info, team details, specific requirements, tone preferences), \
   you weave that context seamlessly into the output. If no description is provided, \
   you generate a complete, compelling job post using industry best practices.

4. **Professional Tone**: Write in an authoritative, practical, enterprise-focused, \
   and outcome-oriented tone. Avoid generic filler. Every sentence should add value.

## Output Rules

- **formatted_job_post**: A complete, polished job posting as one formatted string. \
  Use clear section headings: Title, About the Company (if context given), Position Overview, \
  Primary Responsibilities, Requirements, Preferred Qualifications, and a closing call-to-action. \
  Use bullet points for lists.

- **job_description**: Structured data with title, summary, responsibilities (6-10 items), \
  required_skills (5-8 items), preferred_skills (3-5 items), qualifications (4-6 items), \
  salary_text (use a reasonable market range or say "Competitive, commensurate with experience"), \
  and application_cta.

- **seo_titles**: 3-5 SEO-optimized alternative job titles.
- **meta_description**: A compelling 150-160 character meta description.

## Important Constraints

- Do NOT generate assessments, assessment questions, durations, or scoring rubrics.
- Do NOT copy content verbatim from any source — always write original content.
- Do NOT leave any field empty. Use your expertise to fill every field intelligently.
- If salary info is not provided, use a reasonable market estimate or "Competitive compensation".
- Return ONLY valid JSON matching the requested schema. No markdown, no explanation outside JSON.\
"""


def generate_job_post(request: JobPostRequest) -> JobPostResponse:
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is missing. Add it to .env before generating.")

    client = Groq(api_key=settings.groq_api_key)
    completion = client.chat.completions.create(
        model=settings.groq_model,
        temperature=0.4,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(request)},
        ],
    )

    content = completion.choices[0].message.content or "{}"
    payload = _parse_json(content)
    return JobPostResponse.model_validate(payload)


def _build_user_prompt(request: JobPostRequest) -> str:
    schema_hint = {
        "formatted_job_post": (
            "A complete polished job post as one string. Use sections: title line, "
            "Position Overview, Primary Responsibilities, Requirements, "
            "Preferred Qualifications, Compensation, and a closing call-to-action."
        ),
        "job_description": {
            "title": "string",
            "summary": "string",
            "responsibilities": ["string"],
            "required_skills": ["string"],
            "preferred_skills": ["string"],
            "qualifications": ["string"],
            "salary_text": "string",
            "application_cta": "string",
        },
        "seo_titles": ["string"],
        "meta_description": "string",
    }

    parts = [
        f"Role: {request.role}",
        f"Experience Level: {request.experience}",
    ]
    if request.description:
        parts.append(f"Additional Context:\n{request.description}")

    return (
        "Generate a complete, professional job posting based on this input:\n\n"
        + "\n".join(parts)
        + "\n\n"
        "Use your expertise to automatically determine the best skills, "
        "responsibilities, qualifications, and all other details for this role. "
        "The user should NOT need to specify skills — you infer them.\n\n"
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
