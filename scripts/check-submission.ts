// Checks the lablab texts in submission/ against their limits and lists the
// [[placeholders]] still to fill.   npm run check-submission [-- --final]
import { readFileSync } from "node:fs";
import path from "node:path";

const dir = "submission";
const read = (file: string) => readFileSync(path.join(dir, file), "utf8").trim();
const chars = (text: string) => [...text].length;
const words = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
const seconds = (stamp: string) => {
  const [m, s] = stamp.split(":").map(Number);
  return m * 60 + s;
};

const results: { name: string; value: string; ok: boolean }[] = [];
const add = (name: string, value: string | number, ok: boolean) => results.push({ name, value: String(value), ok });

const title = read("title.txt");
add("title.txt characters (max 50)", chars(title), chars(title) <= 50);
const short = read("short.txt");
add("short.txt characters (max 255)", chars(short), chars(short) <= 255);
const long = read("long.md");
add("long.md words (150–250)", words(long), words(long) >= 150 && words(long) <= 250);
const tags = read("tags.txt").split(",").map((tag) => tag.trim()).filter(Boolean);
add("tags.txt tags", tags.length, tags.length > 0);
const slides = read("slides.md").match(/^## \d+\./gm) ?? [];
add("slides.md slides (8–10)", slides.length, slides.length >= 8 && slides.length <= 10);
const video = read("video-script.md");
const stamps = [...video.matchAll(/(\d+:\d{2})–(\d+:\d{2})/g)];
const end = stamps.length ? Math.max(...stamps.map((match) => seconds(match[2]))) : 0;
add("video-script.md length (under 4:30)", `${Math.floor(end / 60)}:${String(end % 60).padStart(2, "0")}`, end > 0 && end < 270);
const demo = stamps.filter((match) => seconds(match[1]) >= 30 && seconds(match[2]) <= 150);
add("video demo segments between 0:30 and 2:30", demo.length, demo.length > 0);
const cover = read("cover-prompt.txt");
add("cover-prompt.txt mentions 16:9 and no logos", "", cover.includes("16:9") && /no logos/i.test(cover));

for (const result of results) console.log(`${result.ok ? "OK  " : "FAIL"}  ${result.name}${result.value ? `: ${result.value}` : ""}`);

const placeholders = ["long.md", "slides.md", "video-script.md", "short.txt", "title.txt"].flatMap((file) =>
  [...read(file).matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => `${file}: ${match[1]}`),
);
if (placeholders.length) {
  console.log(`\n${placeholders.length} placeholders to fill with real numbers before submitting:`);
  for (const placeholder of placeholders) console.log(`  - ${placeholder}`);
}

const failed = results.some((result) => !result.ok) || (process.argv.includes("--final") && placeholders.length > 0);
process.exit(failed ? 1 : 0);
