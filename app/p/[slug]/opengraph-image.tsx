import { ImageResponse } from "next/og";
import { getPollBySlug } from "@/src/lib/db/repo";

export const runtime = "nodejs";
export const alt = "Summa Reu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const poll = await getPollBySlug(slug);
  const title = poll?.title ?? "Votació";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: 60,
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.8, marginBottom: 12 }}>Summa Reu</div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 900,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
      </div>
    ),
    { ...size }
  );
}
