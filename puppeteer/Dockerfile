FROM node:20-bookworm-slim

# dépendances Chrome/Puppeteer
RUN apt-get update && apt-get install -y \
  ca-certificates fonts-liberation \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
  libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
