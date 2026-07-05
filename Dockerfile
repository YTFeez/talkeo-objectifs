FROM node:22-alpine AS builder

WORKDIR /app

COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install --prefix client && npm install --prefix server

COPY client/ ./client/
RUN npm run build --prefix client && test -f /app/client/dist/index.html

FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/src ./src
COPY --from=builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3002
ENV DATA_DIR=/data

EXPOSE 3002

VOLUME ["/data"]

CMD ["node", "src/index.js"]
