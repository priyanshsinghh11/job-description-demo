# AI Job Posting Agent

This project is a local FastAPI web app for generating complete job posts from simple hiring details. It uses Groq for text generation and a local RAG pipeline so uploaded job descriptions can guide the output style without being copied.

The app can generate:

- PDF-style formatted job post matching the uploaded example structure
- Job description
- Responsibilities
- Required and preferred skills
- Qualifications
- SEO title variations
- SEO keywords
- Meta description

## Current Stack

- Backend: Python, FastAPI, Pydantic
- AI model: Groq chat completion API
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- Vector database: local Chroma DB
- Document parsing: `pypdf`, `python-docx`, plain text, Markdown
- Frontend: simple HTML/CSS/JavaScript served by FastAPI
- Storage: local JSON files and local Chroma data for this version

## Folder Structure

```text
app/
  main.py                 FastAPI routes and static UI serving
  schemas.py              Pydantic request and response models
  job_agent.py            Groq prompt and structured generation logic
  document_ingestion.py   Upload saving, text extraction, and document index
  vector_store.py         Chroma DB and embedding model integration
  retriever.py            Builds search queries and retrieves RAG context
  text_splitter.py        Splits extracted document text into chunks
  config.py               Loads settings from .env
  static/
    index.html            Browser UI
    styles.css            UI styling
    app.js                Frontend API calls

scripts/
  smoke_test.py           Quick local API/UI test

data/
  chroma/                 Local vector database, ignored by Git
  uploads/                Uploaded documents, ignored by Git
  drafts/                 Generated drafts, ignored by Git
  documents.json          Uploaded document metadata, ignored by Git
```

## Pipeline Explanation

## RAG Parameters Used in This Demo

These are the current demo parameters. They are intentionally simple because this is a proof of concept, not the final production setup.

| Parameter | Current value | Implemented in |
|---|---|---|
| Embedding model | `sentence-transformers/all-MiniLM-L6-v2` | `app/config.py` |
| Vector database | Local Chroma DB | `app/vector_store.py` |
| Vector DB path | `data/chroma` | `app/config.py` |
| Upload path | `data/uploads` | `app/config.py` |
| Draft path | `data/drafts` | `app/config.py` |
| Document metadata path | `data/documents.json` | `app/document_ingestion.py` |
| Supported files | PDF, DOCX, TXT, Markdown | `app/document_ingestion.py` |
| Chunk size | `1200` characters | `app/text_splitter.py` |
| Chunk overlap | `180` characters | `app/text_splitter.py` |
| Retriever top K | `5` chunks | `app/retriever.py` |
| Similarity metric | Cosine similarity | `app/vector_store.py` |
| Chroma collection | `job_posting_documents` | `app/vector_store.py` |
| Embedding normalization | Enabled with `normalize_embeddings=True` | `app/vector_store.py` |
| LLM provider | Groq | `app/job_agent.py` |
| Default Groq model | `llama-3.3-70b-versatile` | `app/config.py` |
| LLM temperature | `0.4` | `app/job_agent.py` |
| LLM response format | JSON object | `app/job_agent.py` |
| Output validation | Pydantic schema validation | `app/schemas.py`, `app/job_agent.py` |

### Why These Parameters Were Chosen

- `all-MiniLM-L6-v2` is lightweight, free, local, and good enough for a demo.
- Chroma is simple for local prototyping and avoids external vector DB setup.
- `1200` character chunks are large enough to hold useful job-description context.
- `180` character overlap helps preserve context across chunk boundaries.
- `top_k = 5` is enough for short job-description files without adding too much irrelevant context.
- Cosine similarity is a standard choice for normalized sentence embeddings.
- Temperature `0.4` keeps the writing controlled while still allowing polished language.

### Production Improvements

For production, these parameters should be revisited:

- Replace fixed-size chunking with heading-aware chunking by sections like `About the Company`, `Responsibilities`, `Requirements`, and `Benefits`.
- Add metadata filtering by company, department, role, seniority, and document type.
- Add a reranker to improve retrieved context quality.
- Add token-budget controls before sending retrieved context to the LLM.
- Move from local Chroma to PostgreSQL with `pgvector` or a managed vector database.
- Add evaluation checks for copy risk, missing fields, hallucinated benefits, and formatting consistency.

### 1. Manager Enters Job Details

The frontend form collects role details such as:

- Company name
- Company overview
- Company mission
- Role
- Department
- Job type
- Work mode
- Location
- Experience
- Pay range
- Travel requirements
- Benefits
- Required skills
- Preferred skills
- Responsibilities

When the user clicks **Generate**, `app/static/app.js` sends this JSON payload to:

```http
POST /generate-job-post
```

The backend validates the request with `JobPostRequest` in `app/schemas.py`.

### 2. Documents Are Uploaded for RAG

The UI also has a document upload section. Supported files:

- PDF
- DOCX
- TXT
- Markdown

When a file is uploaded, the frontend sends it to:

```http
POST /upload-documents
```

The backend saves the file in:

```text
data/uploads/
```

Then `app/document_ingestion.py` extracts text from the file.

### 3. Document Text Is Split Into Chunks

After text extraction, `app/text_splitter.py` splits the document into smaller chunks.

This matters because the full document may be too large to send to the model. Smaller chunks allow the system to retrieve only the most relevant parts later.

Current chunk settings:

- Chunk size: about 1200 characters
- Overlap: about 180 characters

Overlap helps preserve context between chunks.

### 4. Embeddings Are Created

Each text chunk is converted into an embedding vector using:

```text
sentence-transformers/all-MiniLM-L6-v2
```

This is a free local embedding model. It may download the first time document ingestion runs.

Embedding code is handled in:

```text
app/vector_store.py
```

### 5. Chunks Are Stored in Chroma

The chunk text, metadata, and embeddings are stored in local Chroma DB:

```text
data/chroma/
```

Each uploaded document is also tracked in:

```text
data/documents.json
```

This lets the UI show uploaded documents through:

```http
GET /documents
```

### 6. RAG Retrieval Runs During Generation

When the user generates a job post, `app/retriever.py` builds a search query from the manager input:

- Role
- Department
- Experience
- Required skills
- Preferred skills
- Responsibilities

That query is embedded and searched against Chroma.

The backend retrieves the most relevant document chunks and passes them to the AI generation step as examples.

Important: the retrieved documents are not used for copy-paste. The system prompt tells the model to use them only for:

- Structure
- Difficulty level
- Style
- Realistic expectations

### 7. Groq Generates Structured Output

`app/job_agent.py` sends the manager input plus retrieved RAG context to Groq.

The system prompt tells the model:

- Generate original content
- Do not copy uploaded company documents
- Do not expose confidential details
- Return valid JSON only

The response is validated with `JobPostResponse` in `app/schemas.py`.

If the response does not match the expected structure, FastAPI returns an error instead of silently accepting broken output.

### 8. Generated Draft Is Saved

After successful generation, the app saves a draft JSON file in:

```text
data/drafts/
```

Each draft contains:

- Draft ID
- Created timestamp
- Original input payload
- Generated output payload

This is local-only storage for version 1. In production, this should move to PostgreSQL.

### 9. Frontend Displays the Output

The browser UI renders:

- PDF-style formatted job post
- Summary
- Responsibilities
- Required skills
- Preferred skills
- Qualifications
- SEO titles
- SEO keywords
- Meta description
- Raw JSON

The JSON can be copied from the UI for debugging or review.

## Setup

Create and activate the virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create your local environment file:

```powershell
copy .env.example .env
```

Add your Groq API key to `.env`:

```text
GROQ_API_KEY=your_rotated_groq_key_here
GROQ_MODEL=llama-3.3-70b-versatile
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHROMA_DIR=data/chroma
UPLOAD_DIR=data/uploads
DRAFT_DIR=data/drafts
```

Do not commit `.env`.

## Run the App

Start the server:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open the web UI:

```text
http://127.0.0.1:8000/
```

Open Swagger API docs:

```text
http://127.0.0.1:8000/docs
```

If Windows blocks port `8000`, use another port:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8050
```

Then open:

```text
http://127.0.0.1:8050/
```

## How to Check Everything Works

### 1. Basic Server Check

Open:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

### 2. Run the Smoke Test

With the server running:

```powershell
.\.venv\Scripts\python.exe scripts\smoke_test.py --base-url http://127.0.0.1:8000
```

Expected output:

```text
[ok] /health
[ok] / UI
[ok] /documents
```

If you are using port `8050`, run:

```powershell
.\.venv\Scripts\python.exe scripts\smoke_test.py --base-url http://127.0.0.1:8050
```

### 3. Test Document Upload

Open the UI and upload a PDF, DOCX, TXT, or Markdown file.

Expected behavior:

- Upload succeeds
- Document appears in the RAG Documents panel
- `/documents` returns the uploaded file metadata
- Chroma stores the document chunks locally

### 4. Test Generation

Make sure `.env` contains a valid Groq API key.

Then either use the UI Generate button or run:

```powershell
.\.venv\Scripts\python.exe scripts\smoke_test.py --base-url http://127.0.0.1:8000 --generate
```

Expected behavior:

- Backend retrieves relevant RAG chunks, if any exist
- Groq returns structured JSON
- UI displays the generated job post
- A draft JSON file is saved in `data/drafts/`

## API Endpoints

### Health

```http
GET /health
```

Returns:

```json
{"status":"ok"}
```

### Generate Job Post

```http
POST /generate-job-post
```

Example request:

```json
{
  "company_name": "Ajaia",
  "company_overview": "Ajaia is an AI consultancy and product studio helping organizations move from experimentation to practical AI results.",
  "company_mission": "Help organizations win the AI moment.",
  "role": "React Developer",
  "department": "Engineering",
  "job_type": "Full-time",
  "work_mode": "Remote",
  "location": "India",
  "experience": "2-4 years",
  "pay": "8-12 LPA",
  "required_skills": ["React", "JavaScript", "REST APIs"],
  "preferred_skills": ["Next.js", "TypeScript"],
  "responsibilities": [
    "Build frontend features",
    "Integrate APIs",
    "Work with backend team"
  ]
}
```

### Upload Documents

```http
POST /upload-documents
```

Use multipart form data with:

- `file`
- `role_name`
- `department`
- `document_type`
- `seniority`

### List Documents

```http
GET /documents
```

Returns uploaded document metadata.

### Delete Document

```http
DELETE /documents/{document_id}
```

Deletes the document chunks from Chroma and removes the document metadata from the local document index.

## Security Notes

`.gitignore` excludes:

- `.env`
- `.venv/`
- `data/chroma/`
- `data/uploads/`
- `data/drafts/`
- `data/documents.json`

Do not commit:

- API keys
- Uploaded company documents
- Generated drafts containing confidential content
- Local vector database files

If an API key is pasted in chat, pushed to GitHub, or exposed anywhere public, rotate it immediately.

## Current Limitations

- Drafts are saved as local JSON files, not PostgreSQL records.
- There is no login or user management yet.
- There is no human approval workflow yet.
- There is no frontend framework yet; the current UI is a simple FastAPI-served test console.
- RAG deletion removes vector chunks and metadata, but uploaded source files are kept in `data/uploads/`.
- AI output should always be reviewed before publishing.

## Recommended Next Steps

1. Add PostgreSQL for users, job posts, generated drafts, and document metadata.
2. Add authentication and company-level document separation.
3. Add review states like draft, approved, rejected, and published.
4. Add export options for PDF, DOCX, LinkedIn, Indeed, and Naukri formats.
5. Add prompt versioning and output quality tracking.
