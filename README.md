# ChalanPrint – Smart Ink Saver
Client-side tool that turns colorful challans/invoices into clean, ink-saving printable pages. No backend, no uploads: every pixel is processed in the browser with deterministic image math (no generative AI, so text/numbers are never redrawn).

## Files
- `index.html` – UI shell · `css/style.css` – styling
- `js/processor.js` – image engine (background estimation, normalisation, adaptive threshold, color stamp preservation)
- `js/app.js` – upload, PDF decoding, preview/compare slider, undo/reset, export, A4 PDF, print

## Run locally
Needs internet once for CDN libs (PDF.js 3.11.174, jsPDF 2.5.1).
```
cd chalanprint
python3 -m http.server 8080     # then open http://localhost:8080
```
(Opening index.html directly also works in most browsers; PDF rendering is more reliable over http.)

## Deploy
Static files only. Upload the folder to Netlify / Vercel / Cloudflare Pages / GitHub Pages / any nginx or Apache root. Serve over HTTPS.
**Offline / intranet:** download `pdf.min.js`, `pdf.worker.min.js` and `jspdf.umd.min.js` into `js/vendor/` and change the three URLs (two `<script>` tags in index.html, `workerSrc` in app.js).

## Modes
- **Ink Saver** – flattens colored/shaded paper to white, keeps dark text, lines; optionally keeps colored stamps/logos.
- **Grayscale** – background-corrected grayscale with contrast control.
- **Sharp B&W** – local adaptive threshold (integral image) for pure black on white.
- **Smart Auto** – measures color coverage, paper tone and tone histogram to pick one; it shows what it chose. Always compare with the slider before printing.

## Tips
Threshold ↑ = darker/more ink (use for faint text). Whitening ↑ = removes more background. If thin text fades, lower whitening or switch to Grayscale. Page-render size is capped (~2300–3000 px long edge) for memory; this is ~200 dpi on A4.

## Crop tools (v2)
Open **✂ Crop tools** in the preview toolbar (or Enter to apply, Esc to cancel, Space/✋ to pan, wheel or +/− to zoom).
- **Rectangular Crop** – draw, move, resize via 8 handles, presets (Free, Original, 1:1, 4:3, 3:2, 16:9, A4), exact X/Y/W/H pixel inputs. Output is a lossless pixel copy.
- **Perspective Crop** – four independent corners (or **Auto-detect**, which works best for a light document on a darker surface), then a homography + bilinear warp straightens the page. Output size follows the longest edges of your quadrilateral, capped at 4200 px.
- Crop works on the unmodified original, so you can reopen it and re-adjust or **Restore uncropped** at any time. Filters can be applied before or after cropping.
- **Print now** prints only the processed pages; **Clear all** wipes every page from memory. Nothing is stored, logged or uploaded.
Perspective warping is implemented in plain JS (no OpenCV.js dependency).
