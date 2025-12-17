import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";

const app = express();
app.use(express.json({ limit: "150mb" }));

const PORT = process.env.PORT || 3000;
const MAX_CONCURRENCY = Number(process.env.MAX_CONCURRENCY || 2);

// Semaphore simple
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

app.get("/health", async (req, res) => {
  try {
    await getBrowser();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/render", async (req, res) => {
  await acquire();
  try {
    const { html, htmlPath, url, pdfOptions = {}, waitUntil = "networkidle0" } = req.body || {};
    if (!html && !htmlPath && !url) {
      return res.status(400).json({ error: "Provide html, htmlPath or url" });
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

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

    await new Promise(r => setTimeout(r, 100));
    
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      displayHeaderFooter: false,
      scale: 1,
      timeout: 120000,
      //...pdfOptions
    });

    await page.close();
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdf);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    release();
  }
});

process.on("SIGTERM", async () => {
  try { if (browser) await browser.close(); } catch {}
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Puppeteer Cluster worker listening on ${PORT}`);
});
