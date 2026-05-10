import https from 'node:https'
import { createWriteStream } from 'node:fs'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export interface InstallerOptions {
  templateUrl: string
  configPath: string
  targetPath: (sectionNumber: string) => string
  count?: number
  retries?: number
  userAgent?: string
}

export async function install(options: InstallerOptions): Promise<void> {
  const {
    templateUrl,
    configPath,
    targetPath,
    count = 10,
    retries = 2,
    userAgent = 'Synology-DDNS-Helper'
  } = options

  const original = await readFile(configPath, 'utf-8')
  await writeFile(`${configPath}.bak`, original, 'utf-8')
  console.log(`backed up -> ${configPath}.bak`)

  const stagingDir = await mkdtemp(join(tmpdir(), 'syno-ddns-helper-'))
  const stagedTemplate = join(stagingDir, 'template')

  try {
    await downloadFile(templateUrl, stagedTemplate, { retries, userAgent })
    await chmod(stagedTemplate, 0o755)
    console.log(`downloaded ${templateUrl}`)

    const sections: string[] = []
    for (let i = 1; i <= count; i++) {
      const num = String(i).padStart(2, '0')
      const dest = targetPath(num)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(stagedTemplate, dest)
      await chmod(dest, 0o755)
      sections.push(`[Cloudflare ${num}]`)
      sections.push(`modulepath=${dest}`)
      sections.push('queryurl=https://www.cloudflare.com/')
      console.log(`installed ${dest}`)
    }

    const cleaned = stripCloudflareSections(original).replace(/\s+$/, '')
    const updated = `${cleaned}\n\n${sections.join('\n')}\n`
    await atomicWrite(configPath, updated)
    console.log(`updated ${configPath}`)
  } finally {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function atomicWrite(target: string, data: string): Promise<void> {
  const tmp = `${target}.tmp.${process.pid}`
  await writeFile(tmp, data, 'utf-8')
  try {
    await rename(tmp, target)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
}

function stripCloudflareSections(data: string): string {
  const out: string[] = []
  let inSection = false
  for (const line of data.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[Cloudflare')) {
      inSection = true
      continue
    }
    if (inSection && trimmed.startsWith('[')) {
      inSection = false
    }
    if (!inSection) out.push(line)
  }
  return out.join('\n')
}

interface DownloadOptions {
  retries: number
  userAgent: string
  redirects?: number
}

async function downloadFile(
  url: string,
  dest: string,
  options: DownloadOptions
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      await downloadOnce(url, dest, options)
      return
    } catch (err) {
      lastErr = err
      if (attempt < options.retries) {
        await sleep(500 * (attempt + 1))
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

const MAX_REDIRECTS = 3

function downloadOnce(
  url: string,
  dest: string,
  options: DownloadOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    const fail = (err: Error) => {
      file.destroy()
      unlink(dest)
        .catch(() => {})
        .finally(() => reject(err))
    }

    https
      .get(
        url,
        {
          headers: { 'User-Agent': options.userAgent },
          timeout: 15000
        },
        (res) => {
          const status = res.statusCode ?? 0
          if (status >= 300 && status < 400 && res.headers.location) {
            const redirects = (options.redirects ?? 0) + 1
            if (redirects > MAX_REDIRECTS) {
              fail(new Error(`too many redirects: ${url}`))
              return
            }
            file.destroy()
            downloadOnce(res.headers.location, dest, {
              ...options,
              redirects
            }).then(resolve, reject)
            return
          }
          if (status !== 200) {
            fail(new Error(`download failed: ${url} (status ${status})`))
            return
          }
          res.pipe(file)
          file.on('finish', () => {
            file.close((err) => (err ? fail(err) : resolve()))
          })
          file.on('error', fail)
        }
      )
      .on('timeout', function (this: import('node:http').ClientRequest) {
        this.destroy(new Error(`download timeout: ${url}`))
      })
      .on('error', fail)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
