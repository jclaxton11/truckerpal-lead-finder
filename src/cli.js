#!/usr/bin/env node

import fs from "node:fs";

const cmd = process.argv[2] || "help";

function help() {
  console.log(`lead-finder

Commands:
  help                Show this help
  init                Create a leads.json template
  find [cfg]          Run browser-based search queries and save out/leads-*.{json,csv}
  scripts <url>       Generate suggested public reply + opt-in DM script for a thread URL

This is an MVP. Commands below are designed to avoid scraping private data or enabling spam.`);
}

if (cmd === "help") {
  help();
  process.exit(0);
}

if (cmd === "init") {
  const out = {
    queries: [
      "site:reddit.com/r/Trucking parking full",
      "site:reddit.com/r/OwnerOperators parking full",
      "site:reddit.com/r/Trucking diesel prices app",
      "site:reddit.com/r/Trucking weigh station open closed",
      "truck parking app weather alerts",
      "site:truckersreport.com parking full",
    ],
    offer: { kind: "founders_pass", priceUsd: 49 },
    hooks: ["parking", "fuel_prices", "weigh_stations", "weather_alerts"],
  };
  fs.writeFileSync("leads.json", JSON.stringify(out, null, 2));
  console.log("Wrote leads.json");
  process.exit(0);
}

if (cmd === "find") {
  const { findLeads } = await import("./find.js");
  const headful = process.argv.includes("--headful");
  const limitArg = process.argv.find((x) => x.startsWith("--limit="));
  const limitPerQuery = limitArg ? Number(limitArg.split("=")[1]) : 12;

  const cfgPath = process.argv.find((x) => x && !x.startsWith("-") && x.endsWith(".json")) || "leads.json";
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  const res = await findLeads({
    queries: cfg.queries || [],
    outDir: "out",
    limitPerQuery,
    headful,
  });
  console.log(`Found ${res.count} leads`);
  console.log(`JSON: ${res.jsonPath}`);
  console.log(`CSV:  ${res.csvPath}`);
  process.exit(0);
}

if (cmd === "scripts") {
  const url = process.argv[3];
  if (!url) {
    console.error("Usage: lead-finder scripts <url> [--headful]");
    process.exit(1);
  }
  const { scriptsForUrl } = await import("./scripts.js");
  const headful = process.argv.includes("--headful");
  const out = await scriptsForUrl(url, { headful });
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
help();
process.exit(1);
