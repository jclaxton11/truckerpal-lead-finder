#!/usr/bin/env node

import fs from "node:fs";

const cmd = process.argv[2] || "help";

function help() {
  console.log(`lead-finder

Commands:
  help                Show this help
  init                Create a leads.json template

This is a stub MVP. Next: add "plan" and "scripts" commands.`);
}

if (cmd === "help") {
  help();
  process.exit(0);
}

if (cmd === "init") {
  const out = {
    communities: [
      { name: "r/Trucking", type: "reddit", url: "https://www.reddit.com/r/Trucking/" },
      { name: "TruckersReport", type: "forum", url: "https://www.truckersreport.com/truckingindustryforum/" },
    ],
    offer: { kind: "founders_pass", priceUsd: 49 },
    hooks: ["parking", "weather_alerts", "fills_by"],
    notes: "Paste thread URLs here and generate outreach scripts.",
  };
  fs.writeFileSync("leads.json", JSON.stringify(out, null, 2));
  console.log("Wrote leads.json");
  process.exit(0);
}

console.error(`Unknown command: ${cmd}`);
help();
process.exit(1);
