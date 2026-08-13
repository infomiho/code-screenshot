FROM node:24.14.1-trixie AS build

WORKDIR /service

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json tsdown.config.ts ./
RUN npm run build && npm prune --omit=dev

FROM node:24.14.1-trixie-slim AS node-runtime

FROM chromedp/headless-shell:151.0.7922.34@sha256:88359186a9024c4de0b0245c7001e39d5609e0aa0dafab3a0914e9419f258e28

RUN apt-get update && apt-get install --yes --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/ /usr/local/

WORKDIR /service

COPY --from=build /service/node_modules ./node_modules
COPY --from=build /service/package.json ./package.json
COPY --from=build /service/dist ./dist

ENV NODE_ENV=production \
    BROWSER_EXECUTABLE_PATH=/headless-shell/headless-shell
EXPOSE 4100
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4100/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT []
USER nobody
CMD ["node", "dist/main.mjs"]
