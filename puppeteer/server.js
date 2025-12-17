import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "150mb" })); // ajuste selon tes HTML

const PORT = process.env.PORT || 3000;
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 2);

// mini “semaphore” pour éviter qu’un worker sature
let inFlight = 0;
async function acquire() {
  while (inFlight >= MAX_CONCURRENCY) {
    await new Promise(r => setTimeout(r, 25));
  }
  inFlight++;
}
function release() { inFlight = Math.max(0, inFlight - 1); }

let browser;

async function getBrowser() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none"
    ]
  });
  return browser;
}

app.get("/health", async (req, res) => {
  try {
    const b = await getBrowser();
    res.json({ ok: true, pid: process.pid, ws: !!b });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});


app.post("/render", async (req, res) => {
  const startedAt = Date.now();
  await acquire();

  try {
    const {
      html,
      htmlPath,
      url,
      pdfOptions = {},
      waitUntil = "networkidle0",
      timeoutMs = 60000
    } = req.body || {};

    if (!html && !htmlPath && !url) {
      return res.status(400).json({ error: "Provide html, htmlPath or url" });
    }

    const b = await getBrowser();
    const page = await b.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.setViewport({ width: 1280, height: 720 });

    if (url) {
      await page.goto(url, { waitUntil });
    } 
    else if (htmlPath) {
      if (!fs.existsSync(htmlPath)) {
        return res.status(404).json({ error: "HTML file not found" });
      }
      await page.goto(`file://${htmlPath}`, { waitUntil });
    } 
    else {
      await page.setContent(html, { waitUntil });
    }

    await new Promise(r => setTimeout(r, 100));

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      ...pdfOptions
    });

    await page.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("X-Render-Duration-Ms", String(Date.now() - startedAt));
    res.send(buffer);

  } catch (e) {
    res.status(500).json({ error: String(e) });
  } finally {
    release();
  }
});


process.on("SIGTERM", async () => {
  try { if (browser) await browser.close(); } catch {}
  process.exit(0);
});

app.listen(PORT, () => console.log(`Puppeteer service on :${PORT} (max=${MAX_CONCURRENCY})`));
