from pydantic import BaseModel


class JobPostRequest(BaseModel):
    role: str
    experience: str
    description: str | None = None


class JobDescription(BaseModel):
    title: str
    summary: str
    responsibilities: list[str]
    required_skills: list[str]
    preferred_skills: list[str]
    qualifications: list[str]
    salary_text: str
    application_cta: str


class JobPostResponse(BaseModel):
    formatted_job_post: str = ""
    job_description: JobDescription
    seo_titles: list[str]
    meta_description: str
