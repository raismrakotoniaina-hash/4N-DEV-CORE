FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server ./server
COPY .env.example ./.env.example

EXPOSE 3001

USER node

CMD ["node", "server/server.js"]
