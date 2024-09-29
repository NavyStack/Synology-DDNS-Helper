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
- **Synology NAS와 완벽한 통합**: Synology NAS에 기본 설치된 Node.js를 활용합니다.
- **Comment 기록**: Cloudflare의 DNS 레코드 확인에 영향을 주지 않으며, 사용자 자체의 참조용으로만 사용되는 주석 기록 [Record attributes](https://developers.cloudflare.com/dns/manage-dns-records/reference/record-attributes/)
- **TypeScript로 구현**: 타입 안정성을 보장하고, 유지보수가 쉬워졌습니다.
- **확장 가능한 구조**: 현재는 Cloudflare만 지원하지만, 향후 다른 DDNS 제공자도 쉽게 통합할 수 있도록 설계되었습니다.

## 요구사항

- Node.js가 설치된 **Synology NAS** (일반적으로 기본 제공)
- 템플릿 파일을 다운로드할 수 있는 인터넷 연결

## 설치

### 전제조건

- Cloudflare에 등록된 도메인이 있어야 합니다.
- DDNS로 사용할 도메인 레코드가 Cloudflare에 등록되어 있어야 합니다.

### 설치 방법

1. **Synology NAS 제어판에서 작업 스케줄러 설정**

   - 제어판에서 **작업 스케줄러**를 실행하고 **사용자 정의 스크립트**를 생성합니다.
   - 설정은 다음과 같이 합니다:

   ```
   [일반 설정]
   작업 이름: Cloudflare DDNS (원하는 이름으로 설정 가능)
   사용자: root
   이벤트: 부트업
   활성화됨: 체크
   ```

2. **작업 내용 입력**

   작업 스케줄러의 작업 내용에 다음 명령어를 입력합니다:

   ```bash
   curl https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/main.js | node
   ```

   이 명령어는 스크립트의 최신 버전을 다운로드하고 Synology NAS에서 실행합니다.

## 설정 및 사용 방법

1. **스크립트 실행**:

   - 스크립트 실행을 위해 Synology NAS의 관리자 권한이 필요합니다.

   스크립트는 다음 작업을 수행합니다:

   - `/etc.defaults/ddns_provider.conf` 파일을 읽어옵니다.
   - 기존 Cloudflare 섹션을 모두 제거합니다.
   - [템플릿 URL](https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js)에서 최신 Cloudflare DDNS 템플릿을 다운로드합니다.
   - 최대 10개의 Cloudflare DDNS 구성을 추가합니다.

2. **권한 설정**:
   - 다운로드된 템플릿 파일은 자동으로 `755` 권한으로 설정됩니다.

## 작동 원리

스크립트는 다음 단계로 작동합니다:

1. **구성 파일 읽기**: `ddns_provider.conf` 파일을 읽습니다.
2. **기존 Cloudflare 섹션 제거**: 중복을 방지하기 위해 기존의 Cloudflare 항목을 제거합니다.
3. **템플릿 다운로드**: Cloudflare DDNS 템플릿을 가져와 최대 10개의 Cloudflare 섹션을 생성합니다.
4. **구성 파일 업데이트**: 새롭게 구성된 Cloudflare 항목을 포함하여 `ddns_provider.conf`에 저장합니다.

### 템플릿 세부 정보

[template.js](https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js) 파일은 Cloudflare DDNS 업데이트를 처리하는 로직을 포함하고 있습니다. 이 로직은 매개변수 유효성 검사, 인증 헤더 생성, 그리고 DNS 레코드의 생성 및 업데이트를 관리합니다.

## 커스터마이징 및 확장

**현재는 Cloudflare만 지원**하지만, 이 스크립트는 구조상 다른 DDNS 제공자로 확장하기 쉽게 설계되었습니다. 스크립트를 수정하여 템플릿 다운로드 URL을 업데이트하고, 새로운 제공자의 API에 맞게 로직을 조정하면 추가 제공자를 지원할 수 있습니다.

## 문제 해결

- **구성 파일 문제**: 스크립트가 `ddns_provider.conf` 파일을 읽거나 쓸 수 없을 경우, 권한을 확인하십시오. 필요하다면 `sudo`로 스크립트를 실행하세요.
- **다운로드 오류**: 템플릿 다운로드가 실패할 경우, 인터넷 연결을 확인하고 URL이 올바른지 확인하십시오.

## 개발

프로젝트를 개발하거나 수정하려면 TypeScript 및 Node.js 타입 정의를 설치하세요:

```bash
pnpm install --save-dev typescript @types/node
```

프로젝트는 TypeScript 5.6.2 및 Node.js typings 버전 22.7.4에 맞게 구성되어 있습니다. 필요에 따라 `package.json`에서 이를 수정할 수 있습니다.

## 프로젝트 구조

```
.
├── LICENSE
├── README.md
├── dist
│   └── cloudflare
│       ├── main.js
│       ├── php.js
│       └── template.js
├── node_modules
├── package.json
├── pnpm-lock.yaml
├── src
│   ├── cloudflare
│   │   ├── main.ts
│   │   ├── php.ts
│   │   ├── template.ts
│   │   └── type
│   │       └── example.d.ts
│   └── type
└── tsconfig.json
```

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 배포됩니다.

## 저자

작성자: **NavyStack**

## 기여

버그 제보나 새로운 기능 제안은 언제든지 이슈를 열거나 풀 요청을 제출해 주세요.

## 참고 사항

- **현재는 Cloudflare만 지원**합니다. 다른 DDNS 제공자와 연동하려면 스크립트를 수정해야 합니다.
- 제공된 URL을 통해 템플릿 파일을 정기적으로 업데이트하여 Cloudflare의 API에 따른 DDNS 기능이 최신 상태를 유지합니다.

---

ENG

## Overview

**Synology-DDNS-Helper** is a Node.js-based script designed to enhance the DDNS update functionality of Synology NAS by integrating it with the **Cloudflare DDNS service**. It is implemented in modern TypeScript, ensuring strong type safety and ease of maintenance. **Currently, it only supports Cloudflare**, but it is designed with the flexibility to be expanded to other DDNS providers in the future.

## Key Features

- **Cloudflare DDNS Update Support**: Automatically adds up to 10 configurable Cloudflare DDNS sections.
- **Seamless Integration with Synology NAS**: Utilises Synology's built-in Node.js support.
- **Implemented in TypeScript**: Provides type safety and improved maintainability.
- **Expandable Architecture**: While currently supporting only Cloudflare, it is structured to integrate other DDNS providers with ease in the future.

## Requirements

- **Synology NAS** with Node.js installed (generally included by default)
- Internet access to download the template files

## Installation

### Prerequisites

- You must have a domain registered with Cloudflare.
- The domain record you wish to use for DDNS should already be set up in Cloudflare.

### Installation Steps

1. **Configure Task Scheduler in Synology NAS**

   - Open the **Task Scheduler** from the Synology Control Panel and create a **User-defined Script**.
   - Configure the settings as follows:

   ```
   [General Settings]
   Task Name: Cloudflare DDNS (you may choose your preferred name)
   User: root
   Event: Boot-up
   Enabled: Check
   ```

2. **Enter the Task Script**

   Enter the following command in the task script section:

   ```bash
   curl https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/main.js | node
   ```

   This command will download and execute the latest version of the script directly on your Synology NAS.

## Configuration and Usage

1. **Executing the Script**:

   - Ensure you have administrative privileges on your Synology NAS.

   The script performs the following tasks:

   - Reads the existing DDNS configuration from `/etc.defaults/ddns_provider.conf`.
   - Removes any existing Cloudflare sections.
   - Downloads the latest Cloudflare DDNS template from the [template URL](https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js).
   - Adds up to 10 Cloudflare DDNS configurations.

2. **Permission Settings**:
   - The downloaded template files will have their permissions automatically set to `755`.

## How It Works

The script follows these steps:

1. **Read Configuration File**: Reads the `ddns_provider.conf` file.
2. **Remove Existing Cloudflare Sections**: Eliminates any existing Cloudflare entries to prevent duplication.
3. **Download Template**: Fetches the Cloudflare DDNS template and generates up to 10 Cloudflare sections.
4. **Update Configuration File**: Saves the updated configuration with the newly added Cloudflare entries to `ddns_provider.conf`.

### Template Details

The [template.js](https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js) file contains the logic required to handle Cloudflare DDNS updates. It handles parameter validation, authentication header generation, and the creation or updating of DNS records.

## Customisation and Extension

**Currently, this script supports only Cloudflare**, but it is structured to be easily extended to other DDNS providers. By modifying the script to update the template download URL and adjusting the logic to fit the API structure of the new provider, additional providers can be supported.

## Troubleshooting

- **Configuration File Issues**: If the script cannot read or write to `ddns_provider.conf`, check your permissions. You may need to run the script with `sudo`.
- **Download Errors**: If the template download fails, ensure you have an active internet connection and that the URL is accessible.

## Development

To develop or modify the project, you may install TypeScript and Node.js type definitions:

```bash
pnpm install --save-dev typescript @types/node
```

The project is configured to use TypeScript 5.6.2 and Node.js typings version 22.7.4. You can adjust these in `package.json` if necessary.

## Project Structure

```
.
├── LICENSE
├── README.md
├── dist
│   └── cloudflare
│       ├── main.js
│       ├── php.js
│       └── template.js
├── node_modules
├── package.json
├── pnpm-lock.yaml
├── src
│   ├── cloudflare
│   │   ├── main.ts
│   │   ├── php.ts
│   │   ├── template.ts
│   │   └── type
│   │       └── example.d.ts
│   └── type
└── tsconfig.json
```

## Licence

This project is licensed under the MIT Licence.

## Author

Author: **NavyStack**

## Contributions

Feel free to open an issue or submit a pull request if you have any bug reports or suggestions for new features.

## Notes

- **Currently, only Cloudflare is supported**. If you want to use another DDNS provider, you will need to modify the script.
- The template file is regularly updated via the provided URL, ensuring that the DDNS functionality remains up-to-date with Cloudflare's API.
