# Image for the daily traffic aggregation task (sst.aws.Task "Analytics").
#
# Deliberately mirrors ./update.Dockerfile's instruction order (same base, same
# COPY, same `npm ci`) so buildx reuses those layers instead of re-running an
# emulated `npm ci` on every arm64 build. Only the CMD differs — s5cmd is left
# out because this job never touches the DB, it only reads CloudWatch and writes
# small JSON to S3.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
CMD ["npx", "tsx", "deploy/analytics.ts"]
