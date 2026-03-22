// wp-to-markdown.js
const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");
const he = require("he");

const INPUT_FILE = "export.xml";
const OUTPUT_DIR = "output";

async function main() {
  const xml = fs.readFileSync(INPUT_FILE, "utf8");

  const parser = new xml2js.Parser({
    explicitArray: false,
    preserveChildrenOrder: true,
  });
  const result = await parser.parseStringPromise(xml);

  const channel = result.rss.channel;
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];
  console.log("Total items in export:", items.length);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const item of items) {
    const postType = item["wp:post_type"];
    const status = item["wp:status"];

    console.log("Item:", item.title, "postType:", postType, "status:", status);

    const contentEncoded = item["content:encoded"] || "";
    if (!contentEncoded) continue; // skip items with no body

    const title = (item.title || "").trim();
    const slug = (item["wp:post_name"] || "").trim() || slugify(title);
    const decodedHtml = he.decode(contentEncoded);

    const date = item["wp:post_date"] || "";
    const excerpt = (item["excerpt:encoded"] || "").trim();

    const frontmatter =
      `---\n` +
      `title: "${escapeQuotes(title)}"\n` +
      `slug: "${slug}"\n` +
      `date: "${date}"\n` +
      `type: "${postType}"\n` +
      `excerpt: "${escapeQuotes(singleLine(excerpt))}"\n` +
      `---\n\n`;

    const body = decodedHtml.trim() + "\n";

    const filename = `${slug || "untitled"}.md`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, frontmatter + body, "utf8");
    console.log(`Wrote ${filepath}`);
  }

  console.log("Done.");
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

function escapeQuotes(str) {
  return str.replace(/"/g, '\\"');
}

function singleLine(str) {
  return str.replace(/\s+/g, " ").trim();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
