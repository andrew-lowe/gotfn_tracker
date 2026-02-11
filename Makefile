.PHONY: dev server client test build clean clean-dev clean-prod reset reset-dev reset-prod install prod

make help:
	@echo "Usage: make <target>"
	@echo "Targets:"
	@echo "  dev       - Start both server and client (dev DB)"
	@echo "  server    - Start server only (with auto-reload, dev DB)"
	@echo "  client    - Start client only"
	@echo "  test      - Run all tests"
	@echo "  install   - Install dependencies"
	@echo "  build     - Build for production"
	@echo "  prod      - Build and run in production mode (prod DB)"
	@echo "  clean-dev - Delete dev database (reseeds on next dev start)"
	@echo "  clean-prod - Delete prod database (reseeds on next prod start)"
	@echo "  clean     - Delete both databases"
	@echo "  reset-dev - Reset dev: delete dev DB and restart dev"
	@echo "  reset-prod - Reset prod: delete prod DB and rebuild+start prod"
	@echo "  reset     - Default reset targets dev"

# Start both server and client (dev DB)
dev:
	npm run dev

# Start server only (with auto-reload, dev DB)
server:
	npm run dev:server

# Start client only
client:
	npm run dev:client

# Run all tests
test:
	node --test server/tests/*.test.js

# Install dependencies
install:
	npm install

# Build for production
build:
	npm run build

# Build and run in production mode (prod DB)
prod: build
	NODE_ENV=production node server/index.js

# Delete dev database (reseeds on next dev start)
clean-dev:
	rm -f server/forbidden_north_dev.db server/forbidden_north_dev.db-wal server/forbidden_north_dev.db-shm
	@echo "Dev database deleted. Will reseed on next start."

# Delete prod database (reseeds on next prod start) — requires confirmation
clean-prod:
	@echo "WARNING: This will permanently delete the production database."
	@printf "Type 'delete prod' to confirm: " && read answer && [ "$$answer" = "delete prod" ] || (echo "Aborted."; exit 1)
	rm -f server/forbidden_north.db server/forbidden_north.db-wal server/forbidden_north.db-shm
	@echo "Prod database deleted. Will reseed on next start."

# Delete both databases
clean: clean-dev clean-prod

# Reset dev: delete dev DB and restart dev
reset-dev: clean-dev dev

# Reset prod: delete prod DB and rebuild+start prod
reset-prod: clean-prod prod

# Default reset targets dev
reset: reset-dev
