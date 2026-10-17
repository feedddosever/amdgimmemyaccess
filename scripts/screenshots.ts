// Takes the images for the slides and the lablab page from a running MenuBridge and
// writes them to submission/assets. Retake them once the live model answers, so the
// dish texts are Gemma's and not the canned ones.
//   npm run screenshots -- https://menubridge-nine.vercel.app
// Uses the browser at CHROMIUM_PATH when set, else the installed Google Chrome.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import QRCode from "qrcode";
import { DEMO_PRESETS } from "../lib/site";

const OUT = path.join("submission", "assets");
const INK = "#1c1a17";

async function qrCodes(base: string) {
  // The code a diner scans at table 7: the profile sheet opens in the phone's language.
  const url = `${base}/m/demo-trattoria?table=7`;
  const options = { margin: 4, errorCorrectionLevel: "M" as const, color: { dark: INK, light: "#ffffff" } };
  await QRCode.toFile(path.join(OUT, "qr-menu.png"), url, { ...options, width: 1200 });
  writeFileSync(path.join(OUT, "qr-menu.svg"), await QRCode.toString(url, { ...options, type: "svg" }));
  return url;
}

async function dishCard(page: Page, name: string, file: string) {
  const card = page.locator("main article").filter({ hasText: name }).first();
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: path.join(OUT, file) });
}

async function carbonaraCards(browser: Browser, base: string) {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await phone.newPage();
  await page.goto(`${base}/m/demo-trattoria?lang=ja&aud=first_timer`);
  await dishCard(page, "カルボナーラ", "carbonara-ja-first-timer.png");
  await page.goto(`${base}/m/demo-trattoria?lang=it&aud=foodie`);
  await dishCard(page, "Spaghetti alla carbonara", "carbonara-it-foodie.png");
  await phone.close();
}

// The Japanese first-timer's order, checked: carbonara removed with the reason, cacio e
// pepe kept for the child.
async function orderReview(browser: Browser, base: string) {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const page = await phone.newPage();
  await page.goto(`${base}/m/demo-trattoria?lang=ja&aud=first_timer&table=7`);
  await page.getByLabel("ご注文をお聞かせください").fill(DEMO_PRESETS[0].order);
  await page.getByRole("button", { name: "注文を確認する" }).click();
  await page.getByRole("button", { name: "キッチンに送る" }).waitFor();
  await page.locator('section[aria-labelledby="review-title"]').screenshot({ path: path.join(OUT, "order-review-ja.png") });
  await phone.close();
}

// /demo with the Japanese first-timer's order sent: the phone on the left, the
// Italian ticket on the right. The AMD strip below is cropped off.
async function demoScreen(browser: Browser, base: string) {
  const desk = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await desk.newPage();
  await page.goto(`${base}/demo`);
  const frame = page.frameLocator('iframe[title="Diner phone"]');
  await frame.getByText("スパゲッティ・アッラ・カルボナーラ").waitFor();
  await page.getByRole("button", { name: "Svuota" }).click();
  await frame.getByLabel("ご注文をお聞かせください").fill(DEMO_PRESETS[0].order);
  await frame.getByRole("button", { name: "注文を確認する" }).click();
  await frame.getByRole("button", { name: "キッチンに送る" }).click();
  await page.getByText("Tonnarelli cacio e pepe").first().waitFor();
  const strip = await page.getByLabel("AMD panel").boundingBox();
  await page.screenshot({ path: path.join(OUT, "demo-ticket.png"), clip: { x: 0, y: 0, width: 1440, height: strip ? strip.y - 16 : 1000 } });
  await desk.close();
}

async function main() {
  const base = process.argv[2]?.replace(/\/$/, "");
  if (!base?.startsWith("http")) throw new Error("Usage: npm run screenshots -- https://<your-app>");
  mkdirSync(OUT, { recursive: true });
  console.log(`QR code for ${await qrCodes(base)}`);
  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : { channel: "chrome" });
  try {
    await carbonaraCards(browser, base);
    await orderReview(browser, base);
    await demoScreen(browser, base);
  } finally {
    await browser.close();
  }
  console.log(`Wrote qr-menu.png, qr-menu.svg, carbonara-ja-first-timer.png, carbonara-it-foodie.png, order-review-ja.png and demo-ticket.png to ${OUT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
