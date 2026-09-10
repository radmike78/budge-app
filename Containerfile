# OnlyBudget web build, served by an unprivileged nginx.
# Works with Podman, Docker and OpenShift's arbitrary-UID policy.
#
#   podman build -t onlybudget-web .
#   podman run --rm -p 8080:8080 onlybudget-web

# ---- build stage ----
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx expo export --platform web --output-dir dist && node scripts/postbuild-web.js dist

# ---- runtime stage ----
FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine
LABEL org.opencontainers.image.title="OnlyBudget" \
      org.opencontainers.image.description="Only a budget. Nothing else. Web build of the OnlyBudget app." \
      org.opencontainers.image.source="https://github.com/radmike78/budget-app"
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# nginx-unprivileged already runs as uid 101 and listens on 8080; OpenShift may
# swap the uid for a random one in the root group, which this image supports.
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
