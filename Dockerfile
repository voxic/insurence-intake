FROM node:22-bookworm-slim

WORKDIR /app

# DATA_DIR is set before build so any build-time read matches the runtime
# Fly volume mount; it is also read lazily at request time in the app.
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV NEXT_INTERNAL_PORT=4317
ENV MCP_PORT=4318
ENV MCP_HOST=127.0.0.1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8080
CMD ["node", "scripts/public-demo.mjs"]
