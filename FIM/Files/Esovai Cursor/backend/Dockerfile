FROM node:20-alpine

# better-sqlite3 und native deps (falls später benötigt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY server.js agent.js auth.js ./
COPY scripts/ ./scripts/

# FIM-Hashes beim Build generieren (server.js + agent.js + auth.js)
RUN node scripts/fim-gen.cjs

USER nodejs
EXPOSE 3010
CMD ["node", "server.js"]
