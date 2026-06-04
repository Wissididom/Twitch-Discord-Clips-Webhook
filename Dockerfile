FROM golang:1.21-alpine as builder

WORKDIR /build

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o twitch-discord-clips-webhook .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/twitch-discord-clips-webhook .
COPY config.example.json .

ENV TZ=UTC

CMD ["./twitch-discord-clips-webhook"]
