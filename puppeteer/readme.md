# 🧠 Puppeteer Cluster
### Scalable & Concurrent HTML-to-PDF Rendering Service

Puppeteer Cluster is a **Docker-based, horizontally scalable PDF rendering infrastructure**
built on top of **Puppeteer** and **Chromium**, designed to handle **high-concurrency PDF generation**
without saturating your backend.

It is ideal for platforms that generate **reports, invoices, certificates, academic documents**
or any heavy HTML-to-PDF workload.

---

## 🚀 Features

- 🔁 Horizontal scaling with multiple Puppeteer workers
- ⚖️ Nginx load balancer (round-robin)
- 🚦 Per-worker concurrency limiter
- 🩺 Health check endpoint (`/health`)
- 🧾 HTML **or** URL to PDF rendering
- 🎨 Full CSS & background support (`printBackground: true`)
- 📄 A4 & CSS `@page` support
- 🐳 Fully containerized (Docker & Docker Compose)
- 🔒 Safe browser lifecycle management
- 💥 Designed to prevent Chromium crashes under load

---

## 🏗️ Architecture

Client / Backend (Symfony, Laravel, API, etc.)
|
v
Nginx Load Balancer
|
-----------------------
| | |
Puppeteer-1 Puppeteer-2 Puppeteer-3
| | |
Chromium instances (PDF rendering)


---

## 📦 Typical Use Cases

- School management systems (report cards, transcripts)
- E-commerce invoices and delivery notes
- Certificates & official documents
- High-traffic SaaS platforms
- Any backend suffering from PDF generation bottlenecks

---

## ⚙️ Tech Stack

- **Node.js 20**
- **Puppeteer (Chromium)**
- **Nginx**
- **Docker / Docker Compose**

---

## 📂 Project Structure


---

## 🚀 Quick Start

### 1️⃣ Build & Start the cluster

```bash
docker compose up -d --build
