FROM node:20-bookworm-slim

# dépendances Chrome/Puppeteer
RUN apt-get update && apt-get install -y \
  ca-certificates fonts-liberation \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
  libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Installer Chrome officiel
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-linux.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*


WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/google-chrome
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
