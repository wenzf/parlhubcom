# Image for the scheduled DB-rebuild task (sst.aws.Task "UpdateDb").
# Full install (incl. dev deps: tsx runs the TS ingest scripts directly).
# Keep the base image in sync with ./Dockerfile so both ship the same
# @duckdb/node-api build — a DB written by a newer DuckDB may not open in an
# older one.
FROM node:24-alpine
ARG TARGETARCH
RUN wget -qO /tmp/s5cmd.tgz "https://github.com/peak/s5cmd/releases/download/v2.3.0/s5cmd_2.3.0_Linux-$([ "$TARGETARCH" = "arm64" ] && echo arm64 || echo 64bit).tar.gz" \
    && tar -xzf /tmp/s5cmd.tgz -C /usr/local/bin s5cmd && rm /tmp/s5cmd.tgz
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
CMD ["npx", "tsx", "deploy/update-db.ts"]
