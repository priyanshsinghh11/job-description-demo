from pydantic import BaseModel, Field


class JobPostRequest(BaseModel):
    job_title: str = Field(..., min_length=2)
    description: str = Field(..., min_length=10)
    job_location: str = Field(..., min_length=2)
    compensation: str = Field(..., min_length=2)
    ai_experience: int = Field(..., ge=1, le=5)
    variant_count: int = Field(default=1, ge=1, le=10)


class JobDescription(BaseModel):
    title: str = ""
    summary: str = ""
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    compensation: str = ""
    ai_experience_guidance: str = ""
    application_cta: str = ""


class JobPostVariant(BaseModel):
    job_title: str
    formatted_job_post: str
    job_description: JobDescription = Field(default_factory=JobDescription)
    meta_description: str = ""


class JobPostResponse(BaseModel):
    company_context: str
    variants: list[JobPostVariant]
    seo_titles: list[str] = Field(default_factory=list)
