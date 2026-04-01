import { absoluteBaseUrl } from "@/src/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const baseUrl = absoluteBaseUrl();
  const body = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /dashboard",
    "Disallow: /billing",
    "Disallow: /settings",
    "Disallow: /demo",
    "",
    `Host: ${baseUrl}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
