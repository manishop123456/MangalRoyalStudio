FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api/package.json ./services/api/
COPY apps/storefront/package.json ./apps/storefront/
COPY apps/admin/package.json ./apps/admin/
COPY services/api/prisma ./services/api/prisma
RUN npm ci && npx prisma generate --schema=services/api/prisma/schema.prisma
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@mrs/shared

FROM deps AS api
COPY services/api ./services/api
RUN npm run build --workspace=@mrs/api \
  && mkdir -p /app/services/api/.uploads /app/services/api/.data \
  && chown -R node:node /app/services/api
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=@mrs/api"]

FROM deps AS storefront
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_STOREFRONT_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
ENV NODE_ENV=production \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_STOREFRONT_API_URL=${NEXT_PUBLIC_STOREFRONT_API_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY apps/storefront ./apps/storefront
RUN npm run build --workspace=@mrs/storefront \
  && chown -R node:node /app/apps/storefront
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@mrs/storefront"]

FROM deps AS admin
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NODE_ENV=production \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL} \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY apps/admin ./apps/admin
RUN npm run build --workspace=@mrs/admin \
  && chown -R node:node /app/apps/admin
USER node
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@mrs/admin"]
