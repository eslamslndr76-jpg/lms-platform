/**
 * Certificate PDF Utilities — Print API approach.
 *
 * Uses the browser's native print engine to produce vector PDFs
 * with perfect Arabic text, embedded fonts, and correct RTL shaping.
 */

/* ═══════ A4 Landscape Constants ═══════ */

const A4_WIDTH_MM = 297;
const A4_HEIGHT_MM = 210;

/* ═══════ Font URL Extraction ═══════ */

function extractFontUrl(certHtml: string): string | null {
  const m = certHtml.match(
    /<link[^>]*href="(https:\/\/fonts\.googleapis\.com[^"]*)"[^>]*>/,
  );
  return m ? m[1] : null;
}

/* ═══════ Inject Print-Force CSS ═══════ */

function injectPrintForce(html: string): string {
  const printCss = `
  <style>
    @page { size: ${A4_WIDTH_MM}mm ${A4_HEIGHT_MM}mm; margin: 0 !important; }
    html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; margin: 0 !important; padding: 0 !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  </style>`;

  if (html.includes('print-color-adjust: exact')) {
    return html;
  }
  return html.replace('</head>', `  ${printCss}\n</head>`);
}

/* ═══════ Inject Font Link ═══════ */

function ensureFontLink(html: string): string {
  if (html.includes('fonts.googleapis.com')) return html;
  const fontUrl = extractFontUrl(html);
  if (fontUrl) {
    return html.replace('</head>', `  <link href="${fontUrl}" rel="stylesheet">\n</head>`);
  }
  return html;
}

/* ═══════ Print API — Main Export ═══════ */

export async function downloadCertPdf(
  certHtml: string,
  _filename: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 1. Create a hidden iframe at A4 landscape size
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = `${A4_WIDTH_MM}mm`;
      iframe.style.height = `${A4_HEIGHT_MM}mm`;
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        reject(new Error('Cannot access iframe document'));
        return;
      }

      // 2. Prepare HTML with forced print styles and font link
      let htmlToInject = ensureFontLink(certHtml);
      htmlToInject = injectPrintForce(htmlToInject);

      // 3. Write HTML to iframe
      iframeDoc.open();
      iframeDoc.write(htmlToInject);
      iframeDoc.close();

      // 4. Wait for fonts, then trigger print
      const waitForFontsAndPrint = async () => {
        try {
          if (!iframe.contentWindow) {
            reject(new Error('Iframe lost'));
            return;
          }

          // Wait for font loading
          try {
            await iframe.contentWindow.document.fonts.ready;
          } catch {
            await new Promise((r) => setTimeout(r, 2000));
          }

          // Verify key fonts
          const requiredFonts = ['Noto Kufi Arabic', 'Inter', 'Playfair Display', 'Dancing Script'];
          for (const font of requiredFonts) {
            try {
              await iframe.contentWindow!.document.fonts.load(`16px "${font}"`);
            } catch {
              /* font may not exist */
            }
          }

          // Wait for paint
          await new Promise((r) => setTimeout(r, 1000));

          // Cleanup after print dialog closes
          const cleanup = () => {
            setTimeout(() => {
              if (iframe.parentElement) {
                iframe.parentElement.removeChild(iframe);
              }
            }, 500);
          };

          iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true });
          window.addEventListener('beforeunload', cleanup, { once: true });

          // 5. Trigger print
          iframe.contentWindow!.print();
          resolve();
        } catch (err) {
          if (iframe.parentElement) {
            document.body.removeChild(iframe);
          }
          reject(err);
        }
      };

      // Give iframe time to parse HTML and start loading fonts
      setTimeout(waitForFontsAndPrint, 500);
    } catch (err) {
      reject(err);
    }
  });
}

/* ═══════ Legacy alias ═══════ */

export const generatePdfBlob = downloadCertPdf;
