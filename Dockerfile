FROM node:22-bookworm-slim

WORKDIR /app

# DATA_DIR (transcripts) is set before build so any build-time read matches the
# runtime Fly volume mount; it is also read lazily at request time in the app.
# Backoffice data is in memory and reseeded from the image's seed.json on boot.
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
ENV NEXT_INTERNAL_PORT=4317

COPY package.json package-lock.json ./
# NODE_ENV=production makes `npm ci` skip devDependencies. `next build` still
# needs @tailwindcss/postcss, tailwindcss, and typescript from that set.
RUN npm ci --include=dev

COPY . .
# Prune build-only tooling after compile. MCP is served by Next at /mcp, so no
# tsx process is needed at runtime.
RUN npm run build && npm prune --omit=dev

EXPOSE 8080
CMD ["node", "scripts/public-demo.mjs"]
