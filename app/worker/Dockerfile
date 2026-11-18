FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

COPY certs/global-bundle.pem /app/certs/global-bundle.pem

ENV NODE_ENV=production

USER node

CMD ["node", "src/worker.js"]
