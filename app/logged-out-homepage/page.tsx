// app/logged-out-homepage/page.tsx
import { loadPage, type LoadedPage } from "../../lib/loadPage";

export const dynamic = "force-static"; // optional

export default function LoggedOutHomepage() {
  const page: LoadedPage = loadPage("logged-out-homepage"); // matches logged-out-homepage.md

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold mb-6">{page.title}</h1>
      <article
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </main>
  );
}
