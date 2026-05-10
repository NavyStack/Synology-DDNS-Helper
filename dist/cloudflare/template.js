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

// src/cloudflare/template.ts
var import_node_https = __toESM(require("node:https"));
var import_node_net = require("node:net");
var STATUS = {
  GOOD: "good",
  NOCHG: "nochg",
  BAD_AUTH: "badauth",
  BAD_PARAM: "badparam",
  NO_HOST: "nohost",
  NUM_HOST: "numhost",
  ERROR: "911"
};
var SUCCESS_STATUSES = /* @__PURE__ */ new Set([STATUS.GOOD, STATUS.NOCHG]);
var USER_AGENT = "Synology-DDNS-Helper";
var REQUEST_TIMEOUT_MS = 15e3;
var HOSTNAME_DELIMITER = "---";
var CF_AUTH_ERROR_CODES = /* @__PURE__ */ new Set([
  6003,
  6111,
  7e3,
  7003,
  9106,
  9109,
  9111,
  9201,
  1e4
]);
var GLOBAL_API_KEY_PATTERN = /^[0-9a-z]{37}$/i;
var TOKEN_BEARER_PREFIX = "cfut_";
var AuthError = class extends Error {
};
function exitWith(status) {
  console.log(status);
  process.exit(SUCCESS_STATUSES.has(status) ? 0 : 1);
}
function isValidHostname(hostname) {
  return /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.?$/.test(
    hostname
  );
}
function detectRecordType(ip) {
  if ((0, import_node_net.isIPv4)(ip)) return "A";
  if ((0, import_node_net.isIPv6)(ip)) return "AAAA";
  return null;
}
function buildAuthHeaders(account, secret) {
  const base = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT
  };
  if (secret.startsWith(TOKEN_BEARER_PREFIX)) {
    return { ...base, Authorization: `Bearer ${secret}` };
  }
  if (GLOBAL_API_KEY_PATTERN.test(secret) && account.includes("@")) {
    return { ...base, "X-Auth-Email": account, "X-Auth-Key": secret };
  }
  return { ...base, Authorization: `Bearer ${secret}` };
}
function buildComment() {
  return `Set by github.com/NavyStack/Synology-DDNS-Helper on ${(/* @__PURE__ */ new Date()).toISOString()}`;
}
function request(url, headers, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const req = import_node_https.default.request(
      url,
      { method, headers, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        let data = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(data)
            });
          } catch (err) {
            reject(
              err instanceof Error ? new Error(`invalid json from ${url}: ${err.message}`) : new Error(String(err))
            );
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`request timeout: ${url}`)));
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
async function requestWithRetry(url, headers, method = "GET", body) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await request(url, headers, method, body);
      if (res.status < 500) return res;
      lastErr = new Error(`http ${res.status} from ${url}`);
    } catch (err) {
      lastErr = err;
    }
    if (attempt === 0) await sleep(500);
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
function unwrap(res) {
  const { status, body } = res;
  if (body.success) return body.result;
  const err = body.errors?.[0];
  const message = err?.message ?? `http ${status}`;
  const isAuth = status === 401 || status === 403 || err !== void 0 && CF_AUTH_ERROR_CODES.has(err.code);
  if (isAuth) throw new AuthError(message);
  throw new Error(`cloudflare api error (${err?.code ?? status}): ${message}`);
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchAllZones(headers) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://api.cloudflare.com/client/v4/zones?per_page=50&page=${page}`;
    const res = await requestWithRetry(url, headers);
    const zones = unwrap(res) ?? [];
    all.push(...zones);
    const totalPages = res.body.result_info?.total_pages ?? 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}
function findZone(zones, hostname) {
  const target = hostname.toLowerCase().replace(/\.$/, "");
  let best = null;
  for (const zone of zones) {
    const name = zone.name.toLowerCase();
    if (target === name || target.endsWith(`.${name}`)) {
      if (!best || name.length > best.name.length) best = zone;
    }
  }
  return best;
}
async function findRecords(zoneId, hostname, type, headers) {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=${type}&name=${encodeURIComponent(hostname)}`;
  const res = await requestWithRetry(url, headers);
  return unwrap(res) ?? [];
}
async function createRecord(zoneId, hostname, ip, type, headers) {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
  const body = {
    type,
    name: hostname,
    content: ip,
    ttl: 120,
    proxied: false,
    comment: buildComment()
  };
  const res = await requestWithRetry(url, headers, "POST", body);
  return !!unwrap(res);
}
async function updateRecord(zoneId, record, hostname, ip, type, headers) {
  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${record.id}`;
  const body = {
    type,
    name: hostname,
    content: ip,
    ttl: record.ttl,
    proxied: record.proxied,
    comment: buildComment()
  };
  const res = await requestWithRetry(url, headers, "PUT", body);
  return !!unwrap(res);
}
async function processHost(hostname, ip, type, zones, headers) {
  const zone = findZone(zones, hostname);
  if (!zone) return STATUS.NO_HOST;
  const records = await findRecords(zone.id, hostname, type, headers);
  if (records.length > 1) return STATUS.NUM_HOST;
  const existing = records[0];
  if (!existing) {
    const ok2 = await createRecord(zone.id, hostname, ip, type, headers);
    return ok2 ? STATUS.GOOD : STATUS.ERROR;
  }
  if (existing.content === ip) return STATUS.NOCHG;
  const ok = await updateRecord(zone.id, existing, hostname, ip, type, headers);
  return ok ? STATUS.GOOD : STATUS.ERROR;
}
var FAILURE_PRIORITY = [
  STATUS.BAD_AUTH,
  STATUS.BAD_PARAM,
  STATUS.NO_HOST,
  STATUS.NUM_HOST,
  STATUS.ERROR
];
function summarize(results) {
  for (const status of FAILURE_PRIORITY) {
    if (results.includes(status)) return status;
  }
  return results.includes(STATUS.GOOD) ? STATUS.GOOD : STATUS.NOCHG;
}
async function run() {
  const [account, secret, hostnamesArg, ip] = process.argv.slice(2);
  if (!account || !secret || !hostnamesArg || !ip) return STATUS.BAD_PARAM;
  const recordType = detectRecordType(ip);
  if (!recordType) return STATUS.BAD_PARAM;
  const hostnames = hostnamesArg.split(HOSTNAME_DELIMITER).map((h) => h.trim()).filter((h) => h.length > 0);
  if (hostnames.length === 0) return STATUS.BAD_PARAM;
  if (!hostnames.every(isValidHostname)) return STATUS.BAD_PARAM;
  const headers = buildAuthHeaders(account, secret);
  const zones = await fetchAllZones(headers);
  const results = [];
  for (const hostname of hostnames) {
    results.push(await processHost(hostname, ip, recordType, zones, headers));
  }
  return summarize(results);
}
run().then(exitWith).catch((err) => {
  if (err instanceof AuthError) {
    console.error(`auth failed: ${err.message}`);
    exitWith(STATUS.BAD_AUTH);
  } else {
    console.error("unexpected error:", err instanceof Error ? err.message : err);
    exitWith(STATUS.ERROR);
  }
});
