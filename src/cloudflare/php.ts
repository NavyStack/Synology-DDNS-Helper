#!/usr/bin/env node

import { install } from './installer'

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/NavyStack/SynologyCloudFlareDDNS-WithMultiple/master/cloudflare.php'

const CONFIG_FILE_PATH = '/etc.defaults/ddns_provider.conf'

install({
  templateUrl: TEMPLATE_URL,
  configPath: CONFIG_FILE_PATH,
  targetPath: (num) => `/usr/syno/bin/ddns/cloudflare${num}.php`
}).catch((err: unknown) => {
  console.error('install failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
