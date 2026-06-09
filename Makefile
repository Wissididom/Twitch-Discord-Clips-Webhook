.PHONY: build clean run help fmt vet test

BINARY_NAME=twitch-discord-clips-webhook
GO=go

help:
	@echo "Available targets:"
	@echo "  build       - Build the application"
	@echo "  clean       - Clean build artifacts"
	@echo "  run         - Build and run the application"
	@echo "  fmt         - Format code"
	@echo "  vet         - Run go vet"
	@echo "  test        - Run tests"
	@echo "  deps        - Download dependencies"

build:
	$(GO) build -o $(BINARY_NAME)

clean:
	$(GO) clean
	rm -f $(BINARY_NAME)

run: build
	./$(BINARY_NAME)

fmt:
	$(GO) fmt ./...

vet:
	$(GO) vet ./...

test:
	$(GO) test -v ./...

deps:
	$(GO) mod download
	$(GO) mod tidy

release-linux:
	GOOS=linux GOARCH=amd64 $(GO) build -ldflags="-s -w" -o $(BINARY_NAME)-linux-amd64

release-windows:
	GOOS=windows GOARCH=amd64 $(GO) build -ldflags="-s -w" -o $(BINARY_NAME)-windows-amd64.exe

release-darwin:
	GOOS=darwin GOARCH=amd64 $(GO) build -ldflags="-s -w" -o $(BINARY_NAME)-darwin-amd64
