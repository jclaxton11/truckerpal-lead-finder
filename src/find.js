import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tagLead(text) {
  const t = (text || "").toLowerCase();
  const tags = new Set();
  if (/(parking|parked|spot|spots|out of hours|oos|hours of service|hos)/.test(t)) tags.add("parking");
  if (/(fuel|diesel|def|price|prices)/.test(t)) tags.add("fuel_prices");
  if (/(weigh station|weigh stations|scale house|cat scale|cat scales|weighbridge|port of entry)/.test(t))
    tags.add("weigh_stations");
  if (/(weather|storm|radar|wind|ice|snow|alerts)/.test(t)) tags.add("weather_alerts");
  return [...tags];
}

function toCsv(rows) {
  const headers = [
    "source",
    "query",
    "title",
    "url",
    "snippet",
    "tags",
    "recommended_next_step",
  ];
  const esc = (s) => {
    const x = String(s ?? "");
    if (/[\n\r,\"]/g.test(x)) return `"${x.replace(/\"/g, '""')}"`;
    return x;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => (h === "tags" ? esc((r.tags || []).join("|")) : esc(r[h])))
        .join(",")
    );
  }
  return lines.join("\n");
}

function parseRedditQuery(q) {
  // Supports queries like: "site:reddit.com/r/Trucking parking full"
  const m = q.match(/site:reddit\.com\/r\/([^\s]+)\s+(.*)$/i);
  if (!m) return null;
  return { subreddit: m[1], terms: m[2] };
}

async function redditSearch(page, subreddit, terms) {
  const url = `https://old.reddit.com/r/${encodeURIComponent(subreddit)}/search?q=${encodeURIComponent(
    terms
  )}&restrict_sr=1&sort=new&t=year`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  // If Reddit rate-limits, it may show a basic error page.
  const results = await page.evaluate(() => {
    const out = [];
    const rows = Array.from(document.querySelectorAll(".search-result"));
    for (const r of rows) {
      const a = r.querySelector("a.search-title");
      const sn = r.querySelector(".search-result-body") || r.querySelector(".search-result-header");
      const title = a?.textContent?.trim() || "";
      const href = a?.getAttribute("href") || "";
      const snippet = sn?.textContent?.trim()?.replace(/\s+/g, " ") || "";
      if (!href || !title) continue;
      out.push({ title, url: href, snippet });
    }
    return out;
  });

  return results;
}

function parseTruckersReportQuery(q) {
  const m = q.match(/site:truckersreport\.com\s+(.*)$/i);
  if (!m) return null;
  return { terms: m[1] };
}

async function truckersReportSearch(page, terms) {
  // XenForo search; works without auth for basic queries.
  const url = `https://www.truckersreport.com/truckingindustryforum/search/search?keywords=${encodeURIComponent(
    terms
  )}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  const results = await page.evaluate(() => {
    const out = [];
    const items = Array.from(document.querySelectorAll(".contentRow"));
    for (const it of items) {
      const a = it.querySelector("a[href*='/truckingindustryforum/']");
      const title = a?.textContent?.trim() || "";
      const href = a?.href || "";
      const sn = it.querySelector(".contentRow-snippet")?.textContent?.trim() || "";
      if (!href || !title) continue;
      out.push({ title, url: href, snippet: sn });
    }
    return out;
  });

  return results;
}

export async function findLeads(opts) {
  const {
    outDir = "out",
    limitPerQuery = 12,
    headful = false,
    queries = [],
  } = opts;

  if (!queries.length) throw new Error("No queries provided");

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const leads = [];

  for (const q of queries) {
    let items = [];

    const rq = parseRedditQuery(q);
    if (rq) {
      items = await redditSearch(page, rq.subreddit, rq.terms);
    } else {
      const tq = parseTruckersReportQuery(q);
      if (tq) {
        items = await truckersReportSearch(page, tq.terms);
      } else {
        // Generic web search providers can be added later.
        items = [];
      }
    }

    for (const it of items.slice(0, limitPerQuery)) {
      const tags = tagLead(`${it.title} ${it.snippet}`);
      leads.push({
        source: rq ? `reddit:r/${rq.subreddit}` : q.includes("truckersreport.com") ? "truckersreport" : "web",
        query: q,
        title: it.title,
        url: it.url,
        snippet: it.snippet,
        tags,
        recommended_next_step:
          "Reply publicly first. DM only opt-ins or the OP after engagement (avoid spam/bans).",
      });
    }
  }

  await browser.close();

  // Dedupe by URL
  const seen = new Set();
  const deduped = [];
  for (const l of leads) {
    const u = l.url;
    if (seen.has(u)) continue;
    seen.add(u);
    deduped.push(l);
  }

  const stamp = nowStamp();
  const jsonPath = path.join(outDir, `leads-${stamp}.json`);
  const csvPath = path.join(outDir, `leads-${stamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), leads: deduped }, null, 2));
  fs.writeFileSync(csvPath, toCsv(deduped));

  return { jsonPath, csvPath, count: deduped.length };
}
