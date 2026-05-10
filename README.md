# Synology-DDNS-Helper

## Askfront.com (에스크프론트)

초보자도 편하게 질문할 수 있는 포럼을 준비했습니다.

👉 [Askfront.com (에스크프론트)](https://askfront.com/?navystack)

`에스크프론트`에서는 NavyStack 가이드뿐만 아니라 다양한 질문을 환영합니다.

검색해도 답을 찾기 어려우셨다면, 편하게 질문해보세요.

함께 답을 찾아가는 공간이 되길 바랍니다.

언제든 도움이 필요하시면 말씀해주세요. 감사합니다.

## 개요

**Synology-DDNS-Helper**는 Synology NAS의 DDNS 업데이트 기능을 강화하고, **Cloudflare DDNS 서비스**와 통합하기 위해 설계된 Node.js 기반의 스크립트입니다. 최신 TypeScript로 구현되어 있어 높은 타입 안정성과 유지보수의 용이성을 제공합니다. **현재는 Cloudflare만 지원**하지만, 향후 다양한 DDNS 제공자로 확장할 수 있도록 유연하게 설계되어 있습니다.

## 주요 기능

- **Cloudflare DDNS 업데이트 지원**: 최대 10개의 Cloudflare DDNS 섹션을 자동으로 추가합니다.
- **IPv4 / IPv6 모두 지원**: 입력된 IP에 따라 `A` 또는 `AAAA` 레코드로 자동 분기합니다.
- **다중 인증 방식 자동 감지**: Global API Key, API Token, DDNS 전용 토큰(`cfut_`) 모두 동일한 입력란으로 처리합니다.
- **다중 호스트 지원**: 호스트 이름 입력란에 `---`로 구분하여 여러 호스트를 한 번에 갱신할 수 있습니다.
- **변경 없음 단축 처리**: 현재 IP가 동일하면 `nochg`만 반환하고 API 호출을 절감합니다.
- **원자적 설정 업데이트**: `ddns_provider.conf`를 `.bak` 백업 + `.tmp` 후 `rename`으로 안전하게 교체합니다.
- **타임아웃 및 재시도**: HTTPS 호출에 15초 타임아웃과 5xx 응답 1회 재시도가 적용됩니다.
- **Comment 기록**: Cloudflare 레코드에 마지막 갱신 시각을 코멘트로 기록합니다 ([Record attributes](https://developers.cloudflare.com/dns/manage-dns-records/reference/record-attributes/)).
- **TypeScript + esbuild**: 강한 타입 검사와 단일 파일 번들로 배포합니다.

## 요구사항

- Node.js **18 이상**이 설치된 **Synology NAS** (DSM 7.x 이상에 기본 제공)
- 템플릿 파일을 다운로드할 수 있는 인터넷 연결
- 대상 도메인이 등록된 Cloudflare 계정과 다음 권한을 가진 토큰 또는 키
  - **권장**: API Token — `Zone : DNS : Edit` + `Zone : Zone : Read` (해당 zone 한정)
  - 또는 DDNS 전용 토큰(`cfut_…`)
  - 또는 Global API Key (이메일과 함께)

## 설치

### 전제조건

- Cloudflare에 도메인이 등록되어 있어야 합니다.
- DDNS로 사용할 zone이 활성 상태여야 합니다.

### 설치 방법

1. **Synology NAS 제어판에서 작업 스케줄러 설정**

   - 제어판 → **작업 스케줄러** → **사용자 정의 스크립트** 생성

   ```
   [일반 설정]
   작업 이름: Cloudflare DDNS (원하는 이름)
   사용자: root
   이벤트: 부트업
   활성화됨: 체크
   ```

2. **작업 내용 입력**

   ```bash
   curl https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/main.js | node
   ```

   이 명령은 최신 인스톨러를 다운로드해 즉시 실행합니다 (esbuild로 번들링되어 단일 파일로 동작).

3. **DDNS 등록 (제어판 → 외부 액세스 → DDNS)**

   | 필드 | 값 |
   | --- | --- |
   | 서비스 공급자 | `Cloudflare 01` (10개 중 아무거나) |
   | 호스트 이름 | `home.example.com` 또는 `a.com---b.com---c.com` |
   | 사용자 이름/이메일 | API Token / DDNS 토큰 사용 시 임의 값, Global API Key 사용 시 Cloudflare 계정 이메일 |
   | 패스워드/키 | API Token / DDNS 토큰 / Global API Key |

## 작동 원리

### 인스톨러 (`main.js`)

1. `/etc.defaults/ddns_provider.conf`를 읽고 `.bak`로 백업합니다.
2. 임시 디렉토리에 [template.js](https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js)를 한 번만 다운로드합니다.
3. `/usr/syno/bin/ddns/cloudflare01.js` ~ `cloudflare10.js` 10개 위치로 복사하고 권한 `0755`로 설정합니다.
4. 기존 `[Cloudflare …]` 섹션을 제거한 뒤 새 섹션 10개를 추가하고, `.tmp` + `rename`으로 원자적으로 저장합니다.

### 런타임 템플릿 (`template.js`)

Synology DDNS 프레임워크가 호출할 때마다 다음을 수행합니다:

1. argv 검증 (사용자/시크릿/호스트/IP).
2. IP에서 record type 자동 결정 (`A` / `AAAA`).
3. 시크릿 형태로 인증 모드 자동 분기:
   - `cfut_` prefix → Bearer 헤더
   - 37자 영숫자 + 이메일 → Global API Key (`X-Auth-Email` + `X-Auth-Key`)
   - 그 외 → Bearer 헤더
4. zone 목록을 페이지네이션으로 모두 수집하고 호스트와 가장 길게 일치하는 zone 선택.
5. 해당 zone에서 동일 type/이름의 레코드 조회:
   - 0개 → 신규 생성 (TTL 120, proxied false).
   - 1개 + IP 동일 → `nochg`.
   - 1개 + IP 변경 → 업데이트 (기존 TTL/proxied 보존).
   - 2개 이상 → `numhost`.
6. 다중 호스트 입력은 `---`로 split해 각각 처리한 뒤 결과를 종합합니다.

### Synology DDNS 응답 코드

| 출력 | 의미 | 종료 코드 |
| --- | --- | --- |
| `good` | 신규 생성 또는 업데이트 성공 | 0 |
| `nochg` | 변경 없음 | 0 |
| `badauth` | 인증 실패 | 1 |
| `badparam` | 잘못된 파라미터 | 1 |
| `nohost` | zone 매칭 실패 | 1 |
| `numhost` | 동일 호스트의 레코드가 2개 이상 | 1 |
| `911` | 일반 오류 (네트워크/타임아웃 등) | 1 |

## 문제 해결

- **`badauth`가 반복**: API Token에 zone DNS 편집 권한이 있는지, Cloudflare 대시보드 → My Profile → API Tokens에서 확인하세요.
- **`nohost`가 반복**: 토큰이 해당 zone을 볼 수 있어야 합니다. zone:read 권한 누락이 가장 흔한 원인입니다.
- **설치 실패**: `ddns_provider.conf` 권한을 확인하고 `sudo`로 실행하세요. 설치 실패 시 `${configPath}.bak`에 원본이 남아 있습니다.
- **로그 확인**: `/var/log/ddns_provider.log`에 모듈 호출 결과가 기록됩니다.

## 개발

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

빌드 산출물은 `dist/cloudflare/`에 생성되며, 저장소에 커밋되어야 `curl | node` 설치 흐름이 동작합니다.

## 프로젝트 구조

```
.
├── LICENSE
├── README.md
├── CHANGELOG.md
├── dist
│   └── cloudflare
│       ├── main.js        # 인스톨러 (번들)
│       ├── php.js         # PHP 변형 인스톨러 (deprecated, 번들)
│       └── template.js    # DDNS 런타임 (번들)
├── src
│   └── cloudflare
│       ├── installer.ts   # 공통 설치 로직
│       ├── main.ts        # JS 인스톨러 진입점
│       ├── php.ts         # PHP 인스톨러 진입점 (deprecated)
│       └── template.ts    # DDNS 런타임
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

> ⚠️ `php.ts` / `php.js`는 외부 PHP 템플릿 저장소에 의존하는 레거시 변형이며, 이후 메이저 버전에서 제거될 예정입니다.

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 배포됩니다.

## 저자

작성자: **NavyStack**

## 기여

버그 제보나 새로운 기능 제안은 언제든지 이슈를 열거나 풀 요청을 제출해 주세요.

---

## Overview

**Synology-DDNS-Helper** is a Node.js script that integrates Synology NAS's DDNS update mechanism with **Cloudflare**. It is implemented in modern TypeScript and bundled with esbuild into self-contained scripts. Cloudflare is the only supported provider today, but the architecture is designed for easy extension.

## Key Features

- **Cloudflare DDNS update** — registers up to 10 configurable Cloudflare DDNS sections.
- **IPv4 and IPv6** — chooses `A` or `AAAA` automatically from the IP argument.
- **Multiple credential types** — Global API Key, API Token, and DDNS-only `cfut_` tokens are auto-detected.
- **Multi-host input** — separate hostnames with `---` to update many at once.
- **`nochg` short-circuit** — skips API writes when the IP hasn't changed.
- **Atomic config updates** — backup (`.bak`), temp file, then `rename`.
- **Timeout + retry** — 15-second HTTPS timeout, single retry on 5xx.
- **Audit comment** — each record gets a comment with the last update timestamp.
- **TypeScript + esbuild** — type-safe source, single-file bundles.

## Requirements

- **Synology NAS** with Node.js 18 or newer (default on DSM 7.x).
- Internet access to fetch the bundled templates.
- A Cloudflare account with one of:
  - **Recommended**: API Token with `Zone : DNS : Edit` + `Zone : Zone : Read` scoped to the target zone.
  - DDNS token (`cfut_…`).
  - Legacy Global API Key (paired with the account email).

## Installation

1. **Open Synology Control Panel → Task Scheduler** and create a User-defined Script:

   ```
   [General Settings]
   Task Name: Cloudflare DDNS
   User: root
   Event: Boot-up
   Enabled: ✓
   ```

2. **Task command**:

   ```bash
   curl https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/main.js | node
   ```

3. **Register a DDNS entry** in *Control Panel → External Access → DDNS*:

   | Field | Value |
   | --- | --- |
   | Service Provider | `Cloudflare 01` (any of the ten) |
   | Hostname | `home.example.com` or `a.com---b.com---c.com` |
   | Username/Email | Any value for API/DDNS tokens, account email for Global API Key |
   | Password/Key | API Token / `cfut_…` / Global API Key |

## How It Works

### Installer (`main.js`)

1. Reads `/etc.defaults/ddns_provider.conf` and writes a `.bak` backup.
2. Downloads `template.js` once into a temp directory.
3. Copies it into `/usr/syno/bin/ddns/cloudflare01.js` … `cloudflare10.js` with mode `0755`.
4. Strips existing `[Cloudflare …]` sections and appends ten new ones, then atomically replaces the config file.

### Runtime template (`template.js`)

Each invocation:

1. Validates arguments.
2. Detects record type (`A` for IPv4, `AAAA` for IPv6).
3. Picks an auth mode by secret shape:
   - `cfut_` prefix → Bearer token
   - 37-char alphanumeric + email → Global API Key
   - otherwise → Bearer token
4. Fetches all zones (paginated) and matches the longest suffix.
5. Looks up records by zone/type/name:
   - 0 → create (`ttl=120`, `proxied=false`).
   - 1 + same IP → `nochg`.
   - 1 + different IP → update, preserving existing TTL/proxied.
   - more than 1 → `numhost`.
6. Multi-host input is split on `---`, processed individually, and the worst status is reported.

### Synology response codes

| stdout | meaning | exit code |
| --- | --- | --- |
| `good` | created or updated | 0 |
| `nochg` | unchanged | 0 |
| `badauth` | authentication failed | 1 |
| `badparam` | invalid parameter | 1 |
| `nohost` | zone not found | 1 |
| `numhost` | multiple records for the same name | 1 |
| `911` | generic failure (network, timeout, …) | 1 |

## Troubleshooting

- **`badauth`** — Verify the token has DNS edit permission on the target zone.
- **`nohost`** — Token also needs `Zone : Zone : Read` on the target zone.
- **Install failure** — Run with `sudo`. The previous config is preserved at `${path}.bak`.
- **Logs** — `/var/log/ddns_provider.log` records each module invocation.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

Bundles are written to `dist/cloudflare/` and committed so the `curl | node` install flow works.

## Project Structure

```
.
├── LICENSE
├── README.md
├── CHANGELOG.md
├── dist
│   └── cloudflare
│       ├── main.js        # installer (bundle)
│       ├── php.js         # PHP variant installer (deprecated, bundle)
│       └── template.js    # DDNS runtime (bundle)
├── src
│   └── cloudflare
│       ├── installer.ts   # shared installer logic
│       ├── main.ts        # JS installer entry point
│       ├── php.ts         # PHP installer entry point (deprecated)
│       └── template.ts    # DDNS runtime
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

> ⚠️ `php.ts` / `php.js` is a legacy variant relying on an external PHP template repo. It will be removed in a future major release.

## Licence

MIT.

## Author

**NavyStack**

## Contributions

Bug reports and feature requests are welcome via issues or pull requests.
