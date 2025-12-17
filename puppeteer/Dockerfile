FROM node:20-bookworm-slim

# 1️⃣ Installer dépendances système + outils nécessaires
RUN apt-get update && apt-get install -y \
  ca-certificates \
  wget \
  gnupg \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 2️⃣ Ajouter la clé et le dépôt Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
  | gpg --dearmor \
  > /usr/share/keyrings/google-linux.gpg

RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
  > /etc/apt/sources.list.d/google-chrome.list

# 3️⃣ Installer Google Chrome
RUN apt-get update && apt-get install -y \
  google-chrome-stable \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 4️⃣ App Node
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# 5️⃣ Variables Puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/google-chrome

EXPOSE 3000
CMD ["node", "server.js"]
