#!/usr/bin/env node

import https from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'
import { isIPv4, isIPv6 } from 'node:net'

const STATUS = {
  GOOD: 'good',
  NOCHG: 'nochg',
  BAD_AUTH: 'badauth',
  BAD_PARAM: 'badparam',
  NO_HOST: 'nohost',
  NUM_HOST: 'numhost',
  ERROR: '911'
} as const
type Status = (typeof STATUS)[keyof typeof STATUS]

const SUCCESS_STATUSES = new Set<Status>([STATUS.GOOD, STATUS.NOCHG])

const USER_AGENT = 'Synology-DDNS-Helper'
const REQUEST_TIMEOUT_MS = 15000
const HOSTNAME_DELIMITER = '---'

const CF_AUTH_ERROR_CODES = new Set([
  6003, 6111, 7000, 7003, 9106, 9109, 9111, 9201, 10000
])

const GLOBAL_API_KEY_PATTERN = /^[0-9a-z]{37}$/i
const TOKEN_BEARER_PREFIX = 'cfut_'

type RecordType = 'A' | 'AAAA'
type Headers = Record<string, string>
type HttpMethod = 'GET' | 'POST' | 'PUT'

interface ApiError {
  code: number
  message: string
}

interface ApiResponse<T> {
  success: boolean
  errors: ApiError[]
  messages: ApiError[]
  result?: T
  result_info?: {
    page: number
    per_page: number
    total_pages: number
    count: number
    total_count: number
  }
}

interface DnsRecord {
  id: string
  type: string
  name: string
  content: string
  ttl: number
  proxied: boolean
}

interface Zone {
  id: string
  name: string
}

interface RawResponse<T> {
  status: number
  body: ApiResponse<T>
}

class AuthError extends Error {}

function exitWith(status: Status): never {
  console.log(status)
  process.exit(SUCCESS_STATUSES.has(status) ? 0 : 1)
}

function isValidHostname(hostname: string): boolean {
  return /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$/.test(
    hostname
  )
}

function detectRecordType(ip: string): RecordType | null {
  if (isIPv4(ip)) return 'A'
  if (isIPv6(ip)) return 'AAAA'
  return null
}

function buildAuthHeaders(account: string, secret: string): Headers {
  const base: Headers = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT
  }
  if (secret.startsWith(TOKEN_BEARER_PREFIX)) {
    return { ...base, Authorization: `Bearer ${secret}` }
  }
  if (GLOBAL_API_KEY_PATTERN.test(secret) && account.includes('@')) {
    return { ...base, 'X-Auth-Email': account, 'X-Auth-Key': secret }
  }
  return { ...base, Authorization: `Bearer ${secret}` }
}

function buildComment(): string {
  return `Set by github.com/NavyStack/Synology-DDNS-Helper on ${new Date().toISOString()}`
}

function request<T>(
  url: string,
  headers: Headers,
  method: HttpMethod = 'GET',
  body?: object
): Promise<RawResponse<T>> {
  return new Promise((resolve, reject) => {
    const req: ClientRequest = https.request(
      url,
      { method, headers, timeout: REQUEST_TIMEOUT_MS },
      (res: IncomingMessage) => {
        let data = ''
        res.setEncoding('utf-8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(data) as ApiResponse<T>
            })
          } catch (err) {
            reject(
              err instanceof Error
                ? new Error(`invalid json from ${url}: ${err.message}`)
                : new Error(String(err))
            )
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error(`request timeout: ${url}`)))
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function requestWithRetry<T>(
  url: string,
  headers: Headers,
  method: HttpMethod = 'GET',
  body?: object
): Promise<RawResponse<T>> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await request<T>(url, headers, method, body)
      if (res.status < 500) return res
      lastErr = new Error(`http ${res.status} from ${url}`)
    } catch (err) {
      lastErr = err
    }
    if (attempt === 0) await sleep(500)
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function unwrap<T>(res: RawResponse<T>): T | undefined {
  const { status, body } = res
  if (body.success) return body.result
  const err = body.errors?.[0]
  const message = err?.message ?? `http ${status}`
  const isAuth =
    status === 401 ||
    status === 403 ||
    (err !== undefined && CF_AUTH_ERROR_CODES.has(err.code))
  if (isAuth) throw new AuthError(message)
  throw new Error(`cloudflare api error (${err?.code ?? status}): ${message}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllZones(headers: Headers): Promise<Zone[]> {
  const all: Zone[] = []
  let page = 1
  while (true) {
    const url = `https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}`
    const res = await requestWithRetry<Zone[]>(url, headers)
    const zones = unwrap(res) ?? []
    all.push(...zones)
    const totalPages = res.body.result_info?.total_pages ?? 1
    if (page >= totalPages) break
    page++
  }
  return all
}

function findZone(zones: Zone[], hostname: string): Zone | null {
  const target = hostname.toLowerCase().replace(/\.$/, '')
  let best: Zone | null = null
  for (const zone of zones) {
    const name = zone.name.toLowerCase()
    if (target === name || target.endsWith(`.${name}`)) {
      if (!best || name.length > best.name.length) best = zone
    }
  }
  return best
}

async function findRecords(
  zoneId: string,
  hostname: string,
  type: RecordType,
  headers: Headers
): Promise<DnsRecord[]> {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(hostname)}`
  const res = await requestWithRetry<DnsRecord[]>(url, headers)
  return unwrap(res) ?? []
}

async function createRecord(
  zoneId: string,
  hostname: string,
  ip: string,
  type: RecordType,
  headers: Headers
): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`
  const body = {
    type,
    name: hostname,
    content: ip,
    ttl: 120,
    proxied: false,
    comment: buildComment()
  }
  const res = await requestWithRetry<DnsRecord>(url, headers, 'POST', body)
  return !!unwrap(res)
}

async function updateRecord(
  zoneId: string,
  record: DnsRecord,
  hostname: string,
  ip: string,
  type: RecordType,
  headers: Headers
): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`
  const body = {
    type,
    name: hostname,
    content: ip,
    ttl: record.ttl,
    proxied: record.proxied,
    comment: buildComment()
  }
  const res = await requestWithRetry<DnsRecord>(url, headers, 'PUT', body)
  return !!unwrap(res)
}

async function processHost(
  hostname: string,
  ip: string,
  type: RecordType,
  zones: Zone[],
  headers: Headers
): Promise<Status> {
  const zone = findZone(zones, hostname)
  if (!zone) return STATUS.NO_HOST

  const records = await findRecords(zone.id, hostname, type, headers)
  if (records.length > 1) return STATUS.NUM_HOST

  const existing = records[0]
  if (!existing) {
    const ok = await createRecord(zone.id, hostname, ip, type, headers)
    return ok ? STATUS.GOOD : STATUS.ERROR
  }

  if (existing.content === ip) return STATUS.NOCHG
  const ok = await updateRecord(zone.id, existing, hostname, ip, type, headers)
  return ok ? STATUS.GOOD : STATUS.ERROR
}

const FAILURE_PRIORITY: Status[] = [
  STATUS.BAD_AUTH,
  STATUS.BAD_PARAM,
  STATUS.NO_HOST,
  STATUS.NUM_HOST,
  STATUS.ERROR
]

function summarize(results: Status[]): Status {
  for (const status of FAILURE_PRIORITY) {
    if (results.includes(status)) return status
  }
  return results.includes(STATUS.GOOD) ? STATUS.GOOD : STATUS.NOCHG
}

async function run(): Promise<Status> {
  const [account, secret, hostnamesArg, ip] = process.argv.slice(2)
  if (!account || !secret || !hostnamesArg || !ip) return STATUS.BAD_PARAM

  const recordType = detectRecordType(ip)
  if (!recordType) return STATUS.BAD_PARAM

  const hostnames = hostnamesArg
    .split(HOSTNAME_DELIMITER)
    .map((h) => h.trim())
    .filter((h) => h.length > 0)
  if (hostnames.length === 0) return STATUS.BAD_PARAM
  if (!hostnames.every(isValidHostname)) return STATUS.BAD_PARAM

  const headers = buildAuthHeaders(account, secret)
  const zones = await fetchAllZones(headers)

  const results: Status[] = []
  for (const hostname of hostnames) {
    results.push(await processHost(hostname, ip, recordType, zones, headers))
  }
  return summarize(results)
}

run()
  .then(exitWith)
  .catch((err: unknown) => {
    if (err instanceof AuthError) {
      console.error(`auth failed: ${err.message}`)
      exitWith(STATUS.BAD_AUTH)
    } else {
      console.error('unexpected error:', err instanceof Error ? err.message : err)
      exitWith(STATUS.ERROR)
    }
  })
