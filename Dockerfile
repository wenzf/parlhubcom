FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json .npmrc /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine
# s5cmd: static Go binary (musl-compatible) for fast parallel S3 downloads
ARG TARGETARCH
RUN wget -qO /tmp/s5cmd.tgz "https://github.com/peak/s5cmd/releases/download/v2.3.0/s5cmd_2.3.0_Linux-$([ "$TARGETARCH" = "arm64" ] && echo arm64 || echo 64bit).tar.gz" \
    && tar -xzf /tmp/s5cmd.tgz -C /usr/local/bin s5cmd && rm /tmp/s5cmd.tgz
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
# The `start` script runs these instead of react-router-serve — see server.js for why.
# server.cjs is the entry point; it must ship alongside server.js.
COPY server.cjs server.js /app/
COPY deploy/entrypoint.sh /app/deploy/entrypoint.sh
WORKDIR /app
ENTRYPOINT ["sh", "/app/deploy/entrypoint.sh"]
CMD ["npm", "run", "start"]
