import type { MetadataRoute } from "next";
import { getAllMarketingPaths } from "@/src/lib/marketing";
import { buildAbsolutePublicUrl } from "@/src/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: buildAbsolutePublicUrl("ca", "/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: buildAbsolutePublicUrl("es", "/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: buildAbsolutePublicUrl("ca", "/help"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: buildAbsolutePublicUrl("es", "/help"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  for (const { locale, slug } of getAllMarketingPaths()) {
    entries.push({
      url: buildAbsolutePublicUrl(locale, `/${slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
