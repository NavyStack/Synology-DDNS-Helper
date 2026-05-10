#!/usr/bin/env node

import { install } from './installer'

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/NavyStack/Synology-DDNS-Helper/master/dist/cloudflare/template.js'

const CONFIG_FILE_PATH = '/etc.defaults/ddns_provider.conf'

install({
  templateUrl: TEMPLATE_URL,
  configPath: CONFIG_FILE_PATH,
  targetPath: (num) => `/usr/syno/bin/ddns/cloudflare${num}.js`
}).catch((err: unknown) => {
  console.error('install failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
