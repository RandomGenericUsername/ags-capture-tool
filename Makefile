.PHONY: help platform-dev contracts-dev deps types test-deps test conformance backend ci bundle typecheck gates clean

# The program tuple this app builds/tests against (AD-31/AD-34). v0.3.0 is the
# REQ-008 adoption tuple and is LOCAL-ONLY in this run: local gates symlink it
# from .dev/ (gitignored), CI checks out the tags explicitly once published.
AGS_PLATFORM_VERSION := v0.3.0
CONTRACTS_VERSION := v0.3.0
AGS_PLATFORM_REPO := https://github.com/RandomGenericUsername/ags-platform.git
AGS_PLATFORM_DEV ?=
PLATFORM_FETCH_DIR := $(CURDIR)/.dev/ags-platform/$(AGS_PLATFORM_VERSION)
PLATFORM_SRC := $(if $(AGS_PLATFORM_DEV),$(AGS_PLATFORM_DEV),$(PLATFORM_FETCH_DIR))
CONTRACTS_REPO := https://github.com/RandomGenericUsername/contracts.git
CONTRACTS_FETCH_DIR := $(CURDIR)/.dev/contracts/$(CONTRACTS_VERSION)
CONTRACTS_ROOT ?= $(CONTRACTS_FETCH_DIR)
BUNDLE_FILE := build/capture.js

help:
	@echo "make test         pure unit/conformance tests (Node only; stock runner)"
	@echo "make conformance  manifest + handler + template conformance"
	@echo "make backend      Python backend pytest suite (needs uv)"
	@echo "make typecheck    desktop-stack tsc gate (LOCAL; needs ags + GIR)"
	@echo "make bundle       ags bundle smoke build (LOCAL; needs ags)"
	@echo "make ci           stock-runner gates: test + conformance + backend"
	@echo "make gates        all local gates: ci + bundle + typecheck"
	@echo ""
	@echo "Local-only v0.3.0 tuple: put a checkout/symlink at"
	@echo "  .dev/ags-platform/v0.3.0  (or AGS_PLATFORM_DEV=/path/to/ags-platform)"
	@echo "and .dev/contracts/v0.3.0 (make conformance links ../contracts, or set CONTRACTS_ROOT)."

# The platform shortcut. It MUST point outside node_modules: Node refuses to
# type-strip `.ts` under a real node_modules directory, but realpaths a symlink
# whose target sits outside. AGS's esbuild resolves the same bare specifier.
platform-dev:
	@mkdir -p "$(dir $(PLATFORM_FETCH_DIR))" node_modules
	@src=""; \
	if [ -n "$(AGS_PLATFORM_DEV)" ]; then \
		src="$(AGS_PLATFORM_DEV)"; \
	elif [ -f "$(PLATFORM_FETCH_DIR)/index.ts" ]; then \
		src="$(PLATFORM_FETCH_DIR)"; \
	elif [ -f "$(CURDIR)/../ags-platform/index.ts" ]; then \
		echo "==> platform-dev: linking local ags-platform checkout at $(PLATFORM_FETCH_DIR)"; \
		ln -sfn ../../../ags-platform "$(PLATFORM_FETCH_DIR)"; \
		src="$(PLATFORM_FETCH_DIR)"; \
	else \
		echo "==> platform-dev: fetching ags-platform $(AGS_PLATFORM_VERSION) (shallow)"; \
		rm -rf "$(PLATFORM_FETCH_DIR)"; \
		git clone --depth 1 --branch $(AGS_PLATFORM_VERSION) $(AGS_PLATFORM_REPO) "$(PLATFORM_FETCH_DIR)" || exit 1; \
		rm -rf "$(PLATFORM_FETCH_DIR)/.git"; \
		src="$(PLATFORM_FETCH_DIR)"; \
	fi; \
	[ -f "$$src/index.ts" ] || { echo "FAIL: platform-dev: $$src/index.ts is missing" >&2; exit 1; }; \
	ln -sfn "$$src" node_modules/ags-platform; \
	echo "==> platform-dev: node_modules/ags-platform -> $$src"

# The contracts shortcut used by the conformance gate. Local runs prefer the
# sibling ../contracts checkout (symlinked under .dev/, which is gitignored);
# CI checks out the pinned tag at the same .dev/ path.
contracts-dev:
	@mkdir -p "$(dir $(CONTRACTS_FETCH_DIR))"
	@if [ -f "$(CONTRACTS_FETCH_DIR)/schemas/ags-app-manifest.schema.json" ]; then \
		:; \
	elif [ -d "$(CURDIR)/../contracts/schemas" ]; then \
		echo "==> contracts-dev: linking local contracts checkout at $(CONTRACTS_FETCH_DIR)"; \
		ln -sfn ../../../contracts "$(CONTRACTS_FETCH_DIR)"; \
	else \
		echo "==> contracts-dev: fetching contracts $(CONTRACTS_VERSION) (shallow)"; \
		rm -rf "$(CONTRACTS_FETCH_DIR)"; \
		git clone --depth 1 --branch $(CONTRACTS_VERSION) $(CONTRACTS_REPO) "$(CONTRACTS_FETCH_DIR)" || exit 1; \
		rm -rf "$(CONTRACTS_FETCH_DIR)/.git"; \
	fi; \
	[ -f "$(CONTRACTS_FETCH_DIR)/schemas/ags-app-manifest.schema.json" ] || { echo "FAIL: contracts-dev: no schema at $(CONTRACTS_FETCH_DIR)" >&2; exit 1; }

# TypeScript for the local typecheck and stock test-typecheck. Installed
# --no-save so no lockfile or node_modules is committed.
deps:
	@if [ ! -x node_modules/.bin/tsc ]; then \
		echo "==> deps: installing typescript@5.9 (npm install --no-save, gitignored)"; \
		npm install --no-save --no-package-lock typescript@5.9 >/dev/null || exit 1; \
	fi

# @types/node lives under tests/ on purpose: the app config pins `"types": []`,
# and the install must stay below the app config's directory so TypeScript's
# default typeRoots walk from the repo root never reaches it.
test-deps: deps
	@if [ ! -d tests/node_modules/@types/node ]; then \
		echo "==> test-deps: installing @types/node under tests/ (gitignored)"; \
		npm install --no-save --no-package-lock --prefix "$(CURDIR)/tests" @types/node@24 >/dev/null || exit 1; \
	fi

# Machine-specific GIR declarations, generated for THIS host. `ags types`
# writes @girs/, env.d.ts and its own tsconfig.json (all gitignored); the
# committed typecheck config is tsconfig.app.json precisely to survive that.
types:
	@command -v ags >/dev/null || { echo "FAIL: types: ags is not on PATH (desktop stack)" >&2; exit 1; }
	@if [ -d "@girs" ]; then \
		echo "==> types: @girs/ already generated, skipping (rm -rf @girs to force)"; \
	else \
		echo "==> types: generating this host's GIR declarations"; \
		ags types -d "$(CURDIR)" -u || exit 1; \
	fi

# Pure tests + copied app tests. Node's native type stripping runs the real
# .ts modules; resolve-hooks.mjs supplies the extensionless resolution the app
# bundler already does. The tests project is typechecked separately.
test: test-deps platform-dev
	@command -v node >/dev/null || { echo "FAIL: test: node is not on PATH" >&2; exit 1; }
	@echo "==> test: node --test tests/unit.test.mjs"
	node --test tests/unit.test.mjs
	@echo "==> test: node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/*.test.ts"
	node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/*.test.ts
	@echo "==> test: tsc --noEmit -p tests/tsconfig.tests.json"
	npx tsc --noEmit -p tests/tsconfig.tests.json

# Manifest/handler/template conformance. The platform's own checkAppRepo gate
# plus the app-specific identity, refresh and backend assertions.
conformance: contracts-dev platform-dev
	@command -v node >/dev/null || { echo "FAIL: conformance: node is not on PATH" >&2; exit 1; }
	@[ -f "$(CONTRACTS_ROOT)/schemas/ags-app-manifest.schema.json" ] || { \
		echo "FAIL: conformance: no contracts schema at $(CONTRACTS_ROOT) (set CONTRACTS_ROOT)" >&2; exit 1; }
	@echo "==> conformance: node --test tests/app-contract.test.mjs"
	CONTRACTS_ROOT="$(CONTRACTS_ROOT)" node --test tests/app-contract.test.mjs

# The Python backend is part of this app (the GUI shells out to it), so its
# suites are gated here rather than in an un-gated monorepo.
backend:
	@command -v uv >/dev/null || { echo "FAIL: backend: uv is not on PATH" >&2; exit 1; }
	@echo "==> backend: uv run --with pytest pytest tests/python -q"
	uv run --with pytest pytest tests/python -q

# Stock-runner gate: exactly what CI runs. No AGS, no GTK, no generated GIR.
ci: test conformance backend

# AGS bundle smoke build. Catches an esbuild resolution/import error the pure
# tests cannot see; LOCAL because it needs the ags CLI.
bundle: platform-dev
	@command -v ags >/dev/null || { echo "FAIL: bundle: ags is not on PATH" >&2; exit 1; }
	@mkdir -p build
	@echo "==> bundle: ags bundle app.tsx $(BUNDLE_FILE)"
	ags bundle app.tsx "$(BUNDLE_FILE)"
	@[ -s "$(BUNDLE_FILE)" ] || { echo "FAIL: bundle: $(BUNDLE_FILE) is empty/missing" >&2; exit 1; }
	@echo "    OK: $(BUNDLE_FILE) ($$(wc -c < "$(BUNDLE_FILE)") bytes)"

# Desktop-stack typecheck: zero errors allowed in this repo's tree. Tolerate
# and count the AGS runtime's own /usr/share/ags/js errors (machine/GIR
# dependent) and the external platform unit's (AD-17: its own repo gates it).
typecheck: deps types platform-dev
	@[ -d "@girs" ] || { echo "FAIL: typecheck: @girs missing after types" >&2; exit 1; }
	@[ -x node_modules/.bin/tsc ] || { echo "FAIL: typecheck: typescript missing after deps" >&2; exit 1; }
	@[ -f node_modules/ags-platform/index.ts ] || { echo "FAIL: typecheck: platform link missing" >&2; exit 1; }
	@[ -e node_modules/ags ] || ln -sfn /usr/share/ags/js node_modules/ags
	@[ -e node_modules/gnim ] || ln -sfn /usr/share/ags/js/node_modules/gnim node_modules/gnim
	@echo "==> typecheck: tsc --noEmit -p tsconfig.app.json"
	@log=$$(mktemp); \
	npx tsc --noEmit -p tsconfig.app.json > "$$log" 2>&1; \
	ours=$$(grep 'error TS' "$$log" | grep -E '^(app\.tsx|lib/|ui/|domain/|ports/|adapters/|types\.ts|env\.d\.ts)' || true); \
	thirdparty=$$(grep 'error TS' "$$log" | grep -F '/usr/share/ags/js/' || true); \
	platform=$$(grep 'error TS' "$$log" | grep -F 'ags-platform/' || true); \
	other=$$(grep 'error TS' "$$log" | grep -vE '^(app\.tsx|lib/|ui/|domain/|ports/|adapters/|types\.ts|env\.d\.ts)' | grep -vF '/usr/share/ags/js/' | grep -vF 'ags-platform/' || true); \
	echo "    tolerated third-party errors (/usr/share/ags/js): $$(printf '%s\n' "$$thirdparty" | grep -c . || true)"; \
	echo "    tolerated ags-platform errors (external unit): $$(printf '%s\n' "$$platform" | grep -c . || true)"; \
	if [ -n "$$other" ]; then \
		echo "FAIL: errors in neither this repo nor the known ags runtime:"; \
		printf '%s\n' "$$other"; rm -f "$$log"; exit 1; \
	fi; \
	if [ -n "$$ours" ]; then \
		echo "FAIL: type errors in the ags-capture-tool tree:"; \
		printf '%s\n' "$$ours"; rm -f "$$log"; exit 1; \
	fi; \
	echo "    OK: 0 errors in the ags-capture-tool tree"; \
	rm -f "$$log"

gates: ci bundle typecheck

clean:
	@rm -rf build
