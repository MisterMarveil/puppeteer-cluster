import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "150mb" }));

const PORT = process.env.PORT || 3005;
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 2);

let inFlight = 0;
async function acquire() {
  while (inFlight >= MAX_CONCURRENCY) {
    await new Promise(r => setTimeout(r, 25));
  }
  inFlight++;
}
function release() {
  inFlight = Math.max(0, inFlight - 1);
}

let browser;
async function getBrowser() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none"
    ]
  });
  return browser;
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "puppeteer-worker",
    pid: process.pid,
    port: PORT
  });
});

app.get("/chrome-health", async (req, res) => {
  try {
    await getBrowser();
    res.json({ ok: true, chrome: true });
  } catch (e) {
    res.status(500).json({ ok: false, chrome: false, error: e.message });
  }
});

app.post("/render", async (req, res) => {
  await acquire();
  let page = null;

  try {
    const {
      html,
      htmlPath,
      url,
      pdfOptions = {},
      waitUntil = "networkidle0"
    } = req.body || {};

    if (!html && !htmlPath && !url) {
      return res.status(400).json({ error: "Provide html, htmlPath or url" });
    }

    const browser = await getBrowser();
    page = await browser.newPage();

    if (url) {
      await page.goto(url, { waitUntil });
    } else if (htmlPath) {
      if (!fs.existsSync(htmlPath)) {
        return res.status(404).json({ error: "HTML file not found" });
      }
      await page.goto(`file://${htmlPath}`, { waitUntil });
    } else {
      await page.setContent(html, { waitUntil });
    }

    // Conservé volontairement pour ne pas modifier le rendu des documents existants.
    await page.emulateMediaType("screen");
    await page.evaluateHandle("document.fonts.ready");
    await new Promise(r => setTimeout(r, 100));

    const hasExplicitFormat =
      typeof pdfOptions.format === "string" && pdfOptions.format.length > 0;
    const hasExplicitDimensions =
      pdfOptions.width !== undefined || pdfOptions.height !== undefined;
    const usesCssPageSize = pdfOptions.preferCSSPageSize === true;

    /*
     * Compatibilité descendante du worker :
     * - appel direct sans taille => A3, exactement comme avant ;
     * - format fourni => on le respecte ;
     * - dimensions personnalisées / @page CSS => pas de format A3 injecté.
     */
    const defaultPdfOptions = {
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      displayHeaderFooter: false,
      scale: 1,
      timeout: 120000
    };

    if (!hasExplicitFormat && !hasExplicitDimensions && !usesCssPageSize) {
      defaultPdfOptions.format = "A3";
    }

    const effectivePdfOptions = {
      ...defaultPdfOptions,
      ...pdfOptions
    };

    const pdf = await page.pdf(effectivePdfOptions);

    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (_) {}

    release();
  }
});

process.on("SIGTERM", async () => {
  try { if (browser) await browser.close(); } catch {}
  process.exit(0);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Puppeteer Cluster worker listening on ${PORT}`);
});
