# octa API image. Build context is the api/ directory (Render "Root Directory" = api).
# Tags verified against the registries on 2026-11-19 (docker manifest inspect).

FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# distroless/static ships CA certificates (the resolver calls oEmbed over HTTPS),
# runs as uid 65532 and has no shell.
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/api /api
USER nonroot:nonroot
# PORT comes from the host (Render sets it); the binary defaults to 8080.
# Health check is configured on the host: GET /healthz.
ENTRYPOINT ["/api"]
