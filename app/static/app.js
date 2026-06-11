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
      <div class="variant-actions">
        <button type="button" class="btn-ghost download-btn" data-format="docx" data-index="${index}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download DOCX
        </button>
        <button type="button" class="btn-ghost download-btn" data-format="pdf" data-index="${index}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PDF
        </button>
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

function parseJobPost(post, fallbackTitle) {
  const lines = cleanPost(post)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let title = "";
  let hasTitleLine = false;
  const sections = [];
  let current = { key: "__intro__", heading: null, blocks: [], chars: 0 };
  sections.push(current);

  for (const line of lines) {
    const normalized = line.replace(/:$/, "").toLowerCase();
    const bulletMatch = line.match(/^[-•●*]\s+(.*)$/);

    if (!title) {
      if (normalized === "title") continue;
      if (!SECTION_HEADINGS.has(normalized)) {
        title = line.replace(/:$/, "");
        hasTitleLine = true;
        continue;
      }
      // Post starts straight at a section heading - use the variant title
      // and let this line be processed as a normal heading below.
      title = fallbackTitle || "Job Post";
    }
    if (
      sections.length === 1 &&
      current.chars === 0 &&
      normalized === title.toLowerCase()
    ) {
      continue;
    }
    if (SECTION_HEADINGS.has(normalized)) {
      current = { key: normalized, heading: line.replace(/:$/, ""), blocks: [], chars: 0 };
      sections.push(current);
    } else if (SUB_HEADINGS.has(normalized)) {
      current.blocks.push({ type: "subheading", text: line.replace(/:$/, "") });
      current.chars += line.length;
    } else if (bulletMatch) {
      current.blocks.push({ type: "bullet", text: bulletMatch[1] });
      current.chars += line.length;
    } else {
      current.blocks.push({ type: "para", text: line });
      current.chars += line.length;
    }
  }

  // Drop duplicate sections, keeping the occurrence with the most content.
  const byKey = new Map();
  const ordered = [];
  for (const section of sections) {
    if (section.key === "__intro__") {
      ordered.push(section);
      continue;
    }
    const existing = byKey.get(section.key);
    if (!existing) {
      byKey.set(section.key, section);
      ordered.push(section);
    } else if (section.chars > existing.chars) {
      existing.heading = section.heading;
      existing.blocks = section.blocks;
      existing.chars = section.chars;
    }
  }

  return { title: title || fallbackTitle || "Job Post", hasTitleLine, sections: ordered };
}

function renderJobPostDocument(post, fallbackTitle) {
  const parsed = parseJobPost(post, fallbackTitle);
  const parts = [];
  if (parsed.hasTitleLine) {
    parts.push(`<h2 class="doc-title">${escapeHtml(parsed.title)}</h2>`);
  }

  for (const section of parsed.sections) {
    if (section.heading) {
      parts.push(`<h3 class="doc-heading">${escapeHtml(section.heading)}</h3>`);
    }
    let listItems = [];
    const flushList = () => {
      if (!listItems.length) return;
      parts.push(`<ul>${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      listItems = [];
    };
    for (const block of section.blocks) {
      if (block.type === "bullet") {
        listItems.push(block.text);
      } else if (block.type === "subheading") {
        flushList();
        parts.push(`<h4 class="doc-subheading">${escapeHtml(block.text)}</h4>`);
      } else {
        flushList();
        parts.push(`<p>${escapeHtml(block.text)}</p>`);
      }
    }
    flushList();
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

function fileSlug(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "job-post"
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadDocx(variant) {
  if (!window.docx) {
    showMessage("DOCX library not loaded. Check your internet connection.", "error");
    return;
  }
  const { Document, Packer, Paragraph, TextRun } = window.docx;
  const parsed = parseJobPost(variant.formatted_job_post, variant.job_title);

  const children = [
    new Paragraph({
      children: [new TextRun({ text: parsed.title, bold: true, size: 56 })],
      spacing: { after: 300 },
    }),
  ];
  for (const section of parsed.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.heading, bold: true, size: 32 })],
          spacing: { before: 320, after: 140 },
        })
      );
    }
    for (const block of section.blocks) {
      if (block.type === "subheading") {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, bold: true, size: 26 })],
            spacing: { before: 180, after: 90 },
          })
        );
      } else if (block.type === "bullet") {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, size: 22 })],
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: block.text, size: 22 })],
            spacing: { after: 140 },
          })
        );
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${fileSlug(parsed.title)}.docx`);
  showMessage(`${parsed.title} downloaded as DOCX.`);
}

function downloadPdf(variant) {
  if (!window.jspdf) {
    showMessage("PDF library not loaded. Check your internet connection.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const parsed = parseJobPost(variant.formatted_job_post, variant.job_title);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;

  // Cover page - navy background, AJAIA wordmark, title, light blue strip.
  doc.setFillColor(11, 31, 94);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("AJAIA", margin, 76);
  doc.setFontSize(34);
  const titleLines = doc.splitTextToSize(parsed.title, pageW - margin * 2 - 40);
  let coverY = pageH - 300;
  doc.text(titleLines, margin, coverY);
  coverY += titleLines.length * 38 + 12;
  doc.setFontSize(14);
  const location = (lastRequest?.job_location || "").trim().replace(/\.$/, "");
  doc.text(["AJAIA", location].filter(Boolean).join("  |  "), margin, coverY);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, pageH - 64, pageW, 8, "F");
  doc.setFillColor(157, 188, 242);
  doc.rect(0, pageH - 56, pageW, 56, "F");

  // Content pages.
  doc.addPage();
  let y = 64;
  const ensureRoom = (needed) => {
    if (y + needed > pageH - 56) {
      doc.addPage();
      y = 64;
    }
  };
  doc.setTextColor(20, 20, 20);

  for (const section of parsed.sections) {
    if (section.heading) {
      ensureRoom(46);
      y += 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(section.heading, margin, y);
      y += 20;
    }
    for (const block of section.blocks) {
      if (block.type === "subheading") {
        ensureRoom(32);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(block.text, margin, y);
        y += 17;
        continue;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const indent = block.type === "bullet" ? 14 : 0;
      const wrapped = doc.splitTextToSize(block.text, maxW - indent);
      for (let i = 0; i < wrapped.length; i++) {
        ensureRoom(16);
        if (block.type === "bullet" && i === 0) doc.text("•", margin, y);
        doc.text(wrapped[i], margin + indent, y);
        y += 15;
      }
      y += block.type === "bullet" ? 3 : 9;
    }
  }

  doc.save(`${fileSlug(parsed.title)}.pdf`);
  showMessage(`${parsed.title} downloaded as PDF.`);
}

resultView.addEventListener("click", (event) => {
  const button = event.target.closest(".download-btn");
  if (!button) return;
  const variant = lastJson?.variants?.[Number(button.dataset.index)];
  if (!variant) return;
  if (button.dataset.format === "docx") {
    downloadDocx(variant);
  } else {
    downloadPdf(variant);
  }
});

copyJson.addEventListener("click", async () => {
  if (!lastJson) return;
  await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2));
  showMessage("JSON copied to clipboard.");
});

jobTypeInput.addEventListener("change", syncJobLocationField);
jobForm.addEventListener("submit", generateJobPost);
checkHealth();
