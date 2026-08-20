/**
 * PDF Export composable (PRD §5.5 — "Annotation export: PDF export of
 * annotated passage (canvas flattened onto scripture text)").
 *
 * Strategy: opens a print-optimised window that contains:
 *   1. The scripture text (rendered as styled HTML)
 *   2. The annotation canvas snapshot (Konva stage.toDataURL())
 *      composited as an absolutely-positioned image over the text
 *
 * The user's OS print dialog handles the actual PDF generation — this
 * works cross-platform, requires zero additional dependencies, and
 * honours the user's paper-size settings.
 *
 * Usage:
 *   const { exportToPdf } = usePdfExport()
 *   await exportToPdf({ passageRef, verses, canvasDataUrl, translation, theme })
 */
export function usePdfExport() {
  /**
   * @param {object} opts
   * @param {string}   opts.passageRef    e.g. "Proverbs 19"
   * @param {string}   opts.translation   e.g. "BSB"
   * @param {Array}    opts.verses        Array of { number, text } objects
   * @param {string|null} opts.canvasDataUrl  Konva stage.toDataURL() or null
   * @param {'light'|'dark'|'sepia'} opts.theme  Current app theme
   */
  async function exportToPdf({ passageRef, translation, verses = [], canvasDataUrl = null, theme = 'light' }) {
    const themeStyles = {
      light: { bg: '#ffffff', text: '#1a1a1a', accent: '#2563eb' },
      sepia: { bg: '#fdf6e3', text: '#3e2f1c', accent: '#8b5e3c' },
      dark:  { bg: '#1f2937', text: '#f9fafb', accent: '#60a5fa' }
    }
    const colours = themeStyles[theme] ?? themeStyles.light

    const versesHtml = verses.map((v) =>
      `<span class="verse">` +
      `<sup class="verse-num">${v.number}</sup>` +
      `${escapeHtml(v.text ?? '')} ` +
      `</span>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(passageRef)} — ${translation}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Palatino Linotype', serif;
      font-size: 13pt;
      line-height: 1.7;
      color: ${colours.text};
      background: ${colours.bg};
      padding: 2cm 2.5cm;
    }
    header { margin-bottom: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.75em; }
    h1 { font-size: 18pt; font-weight: bold; color: ${colours.text}; }
    .meta { font-size: 10pt; color: #888; margin-top: 0.25em; }
    .scripture { position: relative; }
    .canvas-overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: auto;
      pointer-events: none;
      opacity: 0.75;
    }
    .verse-num {
      font-size: 0.65em;
      vertical-align: super;
      color: ${colours.accent};
      font-weight: bold;
      margin-right: 1px;
    }
    footer {
      margin-top: 2em;
      border-top: 1px solid #ccc;
      padding-top: 0.5em;
      font-size: 9pt;
      color: #aaa;
      text-align: center;
    }
    @media print {
      body { padding: 1.5cm 2cm; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(passageRef)}</h1>
    <p class="meta">${translation} · Exported ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </header>

  <div class="scripture">
    ${canvasDataUrl ? `<img class="canvas-overlay" src="${canvasDataUrl}" alt="annotations" />` : ''}
    <p>${versesHtml}</p>
  </div>

  <footer>Bible Study Annotation App · scripture text is public domain</footer>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) {
      // Popup was blocked — fall back to a blob download
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${passageRef.replace(/\s+/g, '_')}.html`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    printWindow.document.write(html)
    printWindow.document.close()
    // Allow images (the canvas overlay) to load before printing
    printWindow.addEventListener('load', () => {
      printWindow.focus()
      printWindow.print()
    })
  }

  return { exportToPdf }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
