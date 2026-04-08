## Stage 1 — React Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline
COPY . .
RUN npm run build

## Stage 2 — nginx Serve
FROM nginx:alpine

ARG ALLOWED_TOKEN
RUN test -n "$ALLOWED_TOKEN" || (echo "ALLOWED_TOKEN required" && exit 1)

COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN sed -i "s/NGINX_TOKEN_PLACEHOLDER/${ALLOWED_TOKEN}/g" /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY public/manifest.json /usr/share/nginx/html/manifest.json
COPY public/sw.js /usr/share/nginx/html/sw.js

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
