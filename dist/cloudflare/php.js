#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cloudflare/installer.ts
var import_node_https = __toESM(require("node:https"));
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
async function install(options) {
  const {
    templateUrl,
    configPath,
    targetPath,
    count = 10,
    retries = 2,
    userAgent = "Synology-DDNS-Helper"
  } = options;
  const original = await (0, import_promises.readFile)(configPath, "utf-8");
  await (0, import_promises.writeFile)(`${configPath}.bak`, original, "utf-8");
  console.log(`backed up -> ${configPath}.bak`);
  const stagingDir = await (0, import_promises.mkdtemp)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "syno-ddns-helper-"));
  const stagedTemplate = (0, import_node_path.join)(stagingDir, "template");
  try {
    await downloadFile(templateUrl, stagedTemplate, { retries, userAgent });
    await (0, import_promises.chmod)(stagedTemplate, 493);
    console.log(`downloaded ${templateUrl}`);
    const sections = [];
    for (let i = 1; i <= count; i++) {
      const num = String(i).padStart(2, "0");
      const dest = targetPath(num);
      await (0, import_promises.mkdir)((0, import_node_path.dirname)(dest), { recursive: true });
      await (0, import_promises.copyFile)(stagedTemplate, dest);
      await (0, import_promises.chmod)(dest, 493);
      sections.push(`[Cloudflare ${num}]`);
      sections.push(`modulepath=${dest}`);
      sections.push("queryurl=https://www.cloudflare.com/");
      console.log(`installed ${dest}`);
    }
    const cleaned = stripCloudflareSections(original).replace(/\s+$/, "");
    const updated = `${cleaned}

${sections.join("\n")}
`;
    await atomicWrite(configPath, updated);
    console.log(`updated ${configPath}`);
  } finally {
    await (0, import_promises.rm)(stagingDir, { recursive: true, force: true }).catch(() => {
    });
  }
}
async function atomicWrite(target, data) {
  const tmp = `${target}.tmp.${process.pid}`;
  await (0, import_promises.writeFile)(tmp, data, "utf-8");
  try {
    await (0, import_promises.rename)(tmp, target);
  } catch (err) {
    await (0, import_promises.unlink)(tmp).catch(() => {
    });
    throw err;
  }
}
function stripCloudflareSections(data) {
  const out = [];
  let inSection = false;
  for (const line of data.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[Cloudflare")) {
      inSection = true;
      continue;
    }
    if (inSection && trimmed.startsWith("[")) {
      inSection = false;
    }
    if (!inSection) out.push(line);
  }
  return out.join("\n");
}
async function downloadFile(url, dest, options) {
  let lastErr;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      await downloadOnce(url, dest, options);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < options.retries) {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
var MAX_REDIRECTS = 3;
function downloadOnce(url, dest, options) {
  return new Promise((resolve, reject) => {
    const file = (0, import_node_fs.createWriteStream)(dest);
    const fail = (err) => {
      file.destroy();
      (0, import_promises.unlink)(dest).catch(() => {
      }).finally(() => reject(err));
    };
    import_node_https.default.get(
      url,
      {
        headers: { "User-Agent": options.userAgent },
        timeout: 15e3
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const redirects = (options.redirects ?? 0) + 1;
          if (redirects > MAX_REDIRECTS) {
            fail(new Error(`too many redirects: ${url}`));
            return;
          }
          file.destroy();
          downloadOnce(res.headers.location, dest, {
            ...options,
            redirects
          }).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          fail(new Error(`download failed: ${url} (status ${status})`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close((err) => err ? fail(err) : resolve());
        });
        file.on("error", fail);
      }
    ).on("timeout", function() {
      this.destroy(new Error(`download timeout: ${url}`));
    }).on("error", fail);
  });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// src/cloudflare/php.ts
var TEMPLATE_URL = "https://raw.githubusercontent.com/NavyStack/SynologyCloudFlareDDNS-WithMultiple/master/cloudflare.php";
var CONFIG_FILE_PATH = "/etc.defaults/ddns_provider.conf";
install({
  templateUrl: TEMPLATE_URL,
  configPath: CONFIG_FILE_PATH,
  targetPath: (num) => `/usr/syno/bin/ddns/cloudflare${num}.php`
}).catch((err) => {
  console.error("install failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
