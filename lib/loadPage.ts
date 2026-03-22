// lib/loadPage.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export type LoadedPage = {
  title: string;
  slug: string;
  date: string;
  type: string;
  excerpt: string;
  html: string;
};

export function loadPage(slug: string): LoadedPage {
  const filePath = path.join(process.cwd(), "content", "pages", `${slug}.md`);
  const file = fs.readFileSync(filePath, "utf8");

  const { data, content } = matter(file);

  return {
    title: (data.title as string) || slug,
    slug: (data.slug as string) || slug,
    date: (data.date as string) || "",
    type: (data.type as string) || "",
    excerpt: (data.excerpt as string) || "",
    html: content,
  };
}
