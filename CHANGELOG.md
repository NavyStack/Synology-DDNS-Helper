# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] — 2026-05-10

### Fixed

- **Authentication**: removed strict 37/40-character secret length check that rejected
  modern Cloudflare API tokens and `cfut_…` DDNS tokens. Auth mode is now picked from
  the secret shape (Bearer for `cfut_…` and most tokens, Global API Key for 37-char
  alphanumeric paired with an email).
- **Exit codes**: `good` and `nochg` now exit with status `0`, all failure tokens with
  status `1`. Previously every invocation exited `1`, causing Synology DSM to mark
  successful updates as failed.
- **IPv6 support**: record type is now derived from the IP argument
  (`A` for IPv4, `AAAA` for IPv6). The previous IPv4-only validator rejected IPv6
  updates with `badparam`.
- **Zone matching**: walks every zone page and selects the longest suffix match,
  preventing wrong-zone updates when both a parent zone and a delegated subzone are
  configured under the same Cloudflare account.
- **`php.ts` path bug**: removed the stray space in `cloudflare ${n}.php` target paths
  that broke `modulepath=` parsing in Synology DDNS configuration.

### Added

- **`nochg` short-circuit**: skips the update API call when the existing record
  already points to the new IP.
- **Multi-host input**: hostnames separated by `---` are split and processed in a
  single invocation; the worst-priority status is returned.
- **`numhost` status**: returned when multiple records exist for the same hostname,
  signalling an ambiguous DDNS target.
- **HTTPS timeouts and retry**: 15-second timeout per request, single retry on 5xx
  responses.
- **User-Agent header**: every Cloudflare and template-download request now sends
  `Synology-DDNS-Helper`.
- **HTTP status code awareness**: 401/403 responses raise `AuthError` even when the
  CF body lacks a recognized error code.
- **Atomic config writes**: `ddns_provider.conf` is written via `${path}.tmp` and
  `rename`. Original is preserved at `${path}.bak`.
- **Single-download install**: the installer downloads `template.js` once into a
  temp directory and copies it to all 10 destinations instead of fetching 10 times.
- **Download retry + redirect handling**: the installer retries failed downloads
  twice and follows up to 3 redirects.
- **`engines` field**: declares Node.js `>=18`.
- **`CHANGELOG.md`**: this file.
- **GitHub Actions CI**: builds the project on PRs and verifies that committed
  `dist/` artefacts match a fresh build.

### Changed

- **Build pipeline**: switched from `tsc` emit to `esbuild --bundle`. `dist/cloudflare/main.js`
  and `dist/cloudflare/php.js` are now self-contained, restoring the
  `curl | node` install flow that broke when the installer logic was extracted into
  a separate module.
- **Installer split**: shared logic moved to `src/cloudflare/installer.ts`; `main.ts`
  and `php.ts` are now thin entry points.
- **Stricter `tsconfig`**: `noUncheckedIndexedAccess`, `Node16` module resolution,
  ES2022 target, explicit `types: ["node"]`.

### Removed

- **Dead types**: deleted `src/cloudflare/type/example.d.ts` (never imported).

### Deprecated

- **`php.ts` / `php.js`**: PHP variant relying on an external PHP template repository
  remains for now but will be removed in a future major release.

## [1.0.0]

- Initial release with Cloudflare DDNS template and installer scripts.
