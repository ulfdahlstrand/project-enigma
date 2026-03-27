// ---------------------------------------------------------------------------
// PDF stylesheet
//
// Imported by pdf.ts and injected into the Puppeteer HTML template.
// All values here are static — no runtime interpolation needed.
// ---------------------------------------------------------------------------

export const PDF_FONT_LINKS = `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;700&family=Open+Sans:wght@400&display=swap" rel="stylesheet" />
`.trim();

export const PDF_CSS = `
  @page {
    size: A4;
  }

  @page :first {
    margin-bottom: 0;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: Constantia, "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
    font-size: 10pt;
    color: #111;
  }

  /* Logical sections — each starts on a new page */
  .section { display: block; }
  .section-break { page-break-after: always; }


  /* Cover page */
  .cover-section { padding-top: 288px; }

  /* Cover page — typography */
  .name-h1 { font-family: "Josefin Sans", sans-serif; font-size: 28pt; font-weight: 700; line-height: 1.1; margin-bottom: 6px; }
  .title-h3 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; color: #111; margin-bottom: 20px; }
  .contact { font-size: 9pt; color: #555; margin-bottom: 16px; }
  .presentation { font-size: 10pt; line-height: 1.6; text-align: justify; margin-bottom: 8px; }

  /* Info box (summary + experience list) */
  .info-box { background: #f5f5f5; padding: 16px 20px; margin-top: 20px; }
  .info-box-label { font-family: "Josefin Sans", sans-serif; font-size: 9pt; font-weight: 700; letter-spacing: 0.08em; color: #111; margin-bottom: 6px; }
  .info-box-body { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #555; line-height: 1.6; margin-bottom: 14px; }
  .exp-summary-heading { margin-top: 4px; }
  .exp-summary-list { list-style: disc; padding-left: 18px; margin: 0; }
  .exp-summary-item { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #555; line-height: 1.8; }

  /* Skills page */
  .name-h2 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; line-height: 1.1; margin-bottom: 0; }
  .profile-h3 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 300; color: #111; margin-bottom: 12px; }
  .skills-columns {
    column-count: 2;
    column-gap: 32px;
    margin-top: 8px;
  }

  /* Category blocks */
  .category-block { margin-bottom: 12px; page-break-inside: avoid; }
  .category-header { background: #f5f5f5; padding: 4px 10px; margin-bottom: 3px; }
  .category-title { font-family: "Josefin Sans", sans-serif; font-size: 10pt; font-weight: 700; letter-spacing: 0.04em; color: #111; }
  .skill-list { font-family: "Open Sans", sans-serif; font-size: 8pt; color: #333; line-height: 1.6; }

  /* Education */
  .section-h4 { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; margin-bottom: 12px; margin-top: 40px; }
  .edu-group { margin-bottom: 12px; page-break-inside: avoid; }
  .edu-label { font-family: "Josefin Sans", sans-serif; font-size: 12pt; font-weight: 700; color: #111; margin-bottom: 4px; }
  .edu-value { font-family: "Open Sans", sans-serif; font-size: 10pt; color: #333; line-height: 1.6; }

  /* Assignments page */
  .assignments-section { page-break-before: always; break-before: page; }
  .assignments-heading { font-family: "Josefin Sans", sans-serif; font-size: 22pt; font-weight: 700; margin-bottom: 16px; padding-top: 4px; }
  .assignments-list { display: flex; flex-direction: column; gap: 36px; }
  .assignment { page-break-inside: avoid; break-inside: avoid; padding-top: 4px; }
  .role-heading {
    font-family: "Josefin Sans", sans-serif;
    font-size: 14pt;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .subtitle { font-family: "Josefin Sans", sans-serif; font-size: 12pt; font-weight: 400; color: #111; margin-bottom: 10px; }
  .tech-box { background: #f5f5f5; padding: 10px 14px; margin-top: 14px; margin-bottom: 8px; }
  .tech-line { margin-bottom: 6px; }
  .tech-line:last-child { margin-bottom: 0; }
  .tech-label { font-size: 8pt; font-weight: 700; letter-spacing: 0.05em; margin-right: 8px; }

  /* Utilities */
  .body2 { font-size: 10pt; line-height: 1.65; }
  .secondary { color: #555; }
  .justified { text-align: justify; margin-bottom: 10px; }
  .justified:last-of-type { margin-bottom: 0; }
`.trim();
