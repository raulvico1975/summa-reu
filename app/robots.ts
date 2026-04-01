import type { MetadataRoute } from "next";
import { absoluteBaseUrl } from "@/src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = absoluteBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/billing", "/settings", "/demo"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
