import { chromium } from "playwright";

function pickHook(tags = []) {
  if (tags.includes("parking")) return "parking";
  if (tags.includes("fuel_prices")) return "fuel_prices";
  if (tags.includes("weigh_stations")) return "weigh_stations";
  if (tags.includes("weather_alerts")) return "weather_alerts";
  return "parking";
}

export async function scriptsForUrl(url, { headful = false } = {}) {
  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  const meta = await page.evaluate(() => {
    const title = document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.title;
    const desc =
      document.querySelector("meta[property='og:description']")?.getAttribute("content") ||
      document.querySelector("meta[name='description']")?.getAttribute("content") ||
      "";
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";
    return { title: (title || h1 || "").trim(), desc: (desc || "").trim() };
  });

  await browser.close();

  const blob = `${meta.title} ${meta.desc}`.toLowerCase();
  const tags = [];
  if (/(parking|parked|spot|out of hours|oos|hos)/.test(blob)) tags.push("parking");
  if (/(fuel|diesel|def|price|prices)/.test(blob)) tags.push("fuel_prices");
  if (/(weigh station|scale house|cat scale|weighbridge|port of entry)/.test(blob)) tags.push("weigh_stations");
  if (/(weather|storm|radar|wind|ice|snow|alerts)/.test(blob)) tags.push("weather_alerts");

  const hook = pickHook(tags);

  const publicReply = {
    parking:
      "Night parking has been brutal. What’s the earliest time you start looking when you know it’s going to be tight? Also: what’s the one thing you wish apps told you before you exit?",
    fuel_prices:
      "Curious what you use for fuel prices right now (if anything). Do you care more about cheapest along route or just knowing what’s fair in an area?",
    weigh_stations:
      "Do you mostly care about weigh station locations, or open/closed status (and bypass info)? What’s the most reliable source you’ve found?",
    weather_alerts:
      "For weather on the road: what do you actually rely on—radar, wind alerts, road conditions? Anything you wish was easier to see without bouncing between apps?",
  }[hook];

  const dmTemplate =
    "Hey — saw your post about parking/weather/fuel. I’m building Trucker Pal (parking status + fills-by + notes + weather alerts). If you want early access, I can send the link. Also: would a $49 founders pass (lifetime premium) be worth it if it saves you time at night?";

  return {
    url,
    title: meta.title,
    description: meta.desc,
    tags,
    suggested_public_reply: publicReply,
    suggested_dm_opt_in:
      "If you want early access, reply IN and I’ll DM the link (no links here to avoid spam).",
    dm_template_after_opt_in: dmTemplate,
  };
}
