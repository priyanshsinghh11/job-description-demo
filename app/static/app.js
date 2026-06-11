const healthStatus = document.querySelector("#healthStatus");
const jobForm = document.querySelector("#jobForm");
const generateButton = document.querySelector("#generateButton");
const copyJson = document.querySelector("#copyJson");
const outputSection = document.querySelector("#outputSection");
const message = document.querySelector("#message");
const resultView = document.querySelector("#resultView");

let lastJson = null;

function formToPayload(form) {
  const data = new FormData(form);
  return {
    role: data.get("role"),
    experience: data.get("experience"),
    description: data.get("description") || null,
  };
}

function showMessage(text, type = "success") {
  message.textContent = text;
  message.className = `message visible ${type}`.trim();
}

function clearMessage() {
  message.textContent = "";
  message.className = "message";
}

async function checkHealth() {
  try {
    const response = await fetch("/health");
    if (!response.ok) throw new Error("Health check failed");
    healthStatus.innerHTML = '<span class="status-dot"></span>API online';
    healthStatus.className = "status ok";
  } catch {
    healthStatus.innerHTML = '<span class="status-dot"></span>API offline';
    healthStatus.className = "status error";
  }
}

async function generateJobPost(event) {
  event.preventDefault();
  clearMessage();
  generateButton.disabled = true;
  generateButton.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
    Generating…
  `;

  // Show output section with loading
  outputSection.style.display = "block";
  resultView.className = "result empty";
  resultView.innerHTML = `
    <div class="generating-indicator">
      <div class="dots"><span></span><span></span><span></span></div>
      <p>AI is crafting your job post…</p>
    </div>
  `;

  try {
    const response = await fetch("/generate-job-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(jobForm)),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail || "Generation failed");
    }

    lastJson = await response.json();
    renderResult(lastJson);
    showMessage("Job post generated successfully!");
  } catch (error) {
    resultView.className = "result empty";
    resultView.innerHTML = `<p style="color:var(--danger);text-align:center;padding:20px;">Generation failed. Please try again.</p>`;
    showMessage(error.message, "error");
  } finally {
    generateButton.disabled = false;
    generateButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      Generate Job Post
    `;
  }
}

function renderResult(data) {
  resultView.className = "result";
  resultView.innerHTML = `
    <article class="result-card full">
      <h3>Job Post</h3>
      <pre class="formatted-job-post">${escapeHtml(data.formatted_job_post || "")}</pre>
    </article>
    <article class="result-card full">
      <h3>SEO Titles</h3>
      ${renderList(data.seo_titles)}
    </article>
    <article class="result-card full">
      <h3>Meta Description</h3>
      <p>${escapeHtml(data.meta_description)}</p>
    </article>
  `;
}

function listCard(title, items) {
  return `<article class="result-card"><h3>${escapeHtml(title)}</h3>${renderList(items)}</article>`;
}

function renderList(items) {
  return `<ul>${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

copyJson.addEventListener("click", async () => {
  if (!lastJson) return;
  await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2));
  showMessage("JSON copied to clipboard!");
});

jobForm.addEventListener("submit", generateJobPost);
checkHealth();
