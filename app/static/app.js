const healthStatus = document.querySelector("#healthStatus");
const jobForm = document.querySelector("#jobForm");
const generateButton = document.querySelector("#generateButton");
const copyJson = document.querySelector("#copyJson");
const outputSection = document.querySelector("#outputSection");
const message = document.querySelector("#message");
const resultView = document.querySelector("#resultView");

const jobTypeInput = document.querySelector("#jobTypeInput");
const jobLocationGroup = document.querySelector("#jobLocationGroup");
const jobLocationInput = document.querySelector("#jobLocationInput");

let lastJson = null;
let lastRequest = null;

function syncJobLocationField() {
  const needsLocation = jobTypeInput.value === "Onsite" || jobTypeInput.value === "Hybrid";
  jobLocationGroup.hidden = !needsLocation;
  jobLocationInput.required = needsLocation;
  if (!needsLocation) jobLocationInput.value = "";
}

function formToPayload(form) {
  const data = new FormData(form);
  const jobType = data.get("job_type");
  const location = (data.get("job_location") || "").trim();
  return {
    job_title: data.get("job_title"),
    description: data.get("description"),
    job_location: location ? `${jobType} - ${location}` : jobType,
    compensation: data.get("compensation"),
    ai_experience: Number(data.get("ai_experience")),
    variant_count: Number(data.get("variant_count") || 1),
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
    Generating...
  `;

  outputSection.style.display = "block";
  resultView.className = "result empty";
  resultView.innerHTML = `
    <div class="generating-indicator">
      <p>Generating AJAIA job variants...</p>
    </div>
  `;

  try {
    lastRequest = formToPayload(jobForm);
    const response = await fetch("/generate-job-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastRequest),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail || "Generation failed");
    }

    lastJson = await response.json();
    renderResult(lastJson);
    showMessage(`${lastJson.variants?.length || 0} job variants generated successfully.`);
  } catch (error) {
    resultView.className = "result empty";
    resultView.innerHTML = `<p class="error-text">Generation failed. Please try again.</p>`;
    showMessage(error.message, "error");
  } finally {
    generateButton.disabled = false;
    generateButton.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      Generate Variants
    `;
  }
}

function renderResult(data) {
  const variants = data.variants || [];
  resultView.className = "result";
  resultView.innerHTML = `
    <article class="result-card full">
      <h3>Job Variants Overview</h3>
      ${renderVariantsTable(variants)}
    </article>
    <article class="result-card full">
      <h3>AJAIA Context Used</h3>
      <p>${escapeHtml(data.company_context || "")}</p>
    </article>
    ${variants.map(renderVariant).join("")}
  `;
}

function renderVariantsTable(variants) {
  const aiLevel = lastRequest?.ai_experience ?? "";
  const rows = variants
    .map((variant, index) => {
      const jd = variant.job_description || {};
      const description = jd.summary || variant.meta_description || "";
      const compensation = lastRequest?.compensation || jd.compensation || "";
      return `
        <tr onclick="document.querySelector('#variant-${index}')?.scrollIntoView({behavior:'smooth'})">
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(variant.job_title)}</strong></td>
          <td>${escapeHtml(description)}</td>
          <td>${escapeHtml(compensation)}</td>
          <td class="col-center">${escapeHtml(String(aiLevel))} / 5</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="table-scroll">
      <table class="variants-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Job Title</th>
            <th>Description</th>
            <th>Compensation</th>
            <th class="col-center">AI Experience</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

const SECTION_HEADINGS = new Set([
  "about the company",
  "position overview",
  "primary responsibilities",
  "job requirements",
  "schedule and location",
  "technical requirements",
  "compensation and benefits",
  "why join ajaia",
]);

const SUB_HEADINGS = new Set(["compensation", "benefits"]);

function renderVariant(variant, index) {
  return `
    <article class="result-card full variant-card" id="variant-${index}">
      <div class="variant-heading">
        <span>Variant ${index + 1}</span>
      </div>
      ${renderCoverPage(variant)}
      <div class="job-post-doc">
        ${renderJobPostDocument(variant.formatted_job_post, variant.job_title)}
      </div>
    </article>
  `;
}

function renderCoverPage(variant) {
  const subtitleParts = ["AJAIA"];
  const location = (lastRequest?.job_location || "").trim().replace(/\.$/, "");
  if (location) subtitleParts.push(location);
  return `
    <div class="cover-page">
      <div class="cover-logo">AJ<span class="cover-logo-mark">A</span>IA</div>
      <div class="cover-body">
        <h2 class="cover-title">${escapeHtml(variant.job_title)}</h2>
        <p class="cover-subtitle">${escapeHtml(subtitleParts.join(" | "))}</p>
      </div>
      <div class="cover-strip"></div>
    </div>
  `;
}

function renderJobPostDocument(post, fallbackTitle) {
  const lines = cleanPost(post)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parts = [];
  let listItems = [];
  let titleRendered = false;
  let titleText = "";

  const flushList = () => {
    if (!listItems.length) return;
    parts.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    const normalized = line.replace(/:$/, "").toLowerCase();
    const bulletMatch = line.match(/^[-•●*]\s+(.*)$/);

    if (!titleRendered) {
      if (normalized === "title") continue;
      parts.push(`<h2 class="doc-title">${escapeHtml(line)}</h2>`);
      titleRendered = true;
      titleText = normalized;
    } else if (parts.length === 1 && normalized === titleText) {
      continue;
    } else if (SECTION_HEADINGS.has(normalized)) {
      flushList();
      parts.push(`<h3 class="doc-heading">${escapeHtml(line.replace(/:$/, ""))}</h3>`);
    } else if (SUB_HEADINGS.has(normalized)) {
      flushList();
      parts.push(`<h4 class="doc-subheading">${escapeHtml(line.replace(/:$/, ""))}</h4>`);
    } else if (bulletMatch) {
      listItems.push(bulletMatch[1]);
    } else {
      flushList();
      parts.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  flushList();

  if (!titleRendered && fallbackTitle) {
    parts.unshift(`<h2 class="doc-title">${escapeHtml(fallbackTitle)}</h2>`);
  }
  return parts.join("");
}

function cleanPost(value) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s+/, ""))
    .join("\n")
    .trim();
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
  showMessage("JSON copied to clipboard.");
});

jobTypeInput.addEventListener("change", syncJobLocationField);
jobForm.addEventListener("submit", generateJobPost);
checkHealth();
