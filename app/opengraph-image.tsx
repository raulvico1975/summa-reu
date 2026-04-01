import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Summa Reu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>Summa Reu</div>
        <div style={{ fontSize: 28, marginTop: 16, opacity: 0.9 }}>
          Coordina reunions amb claredat
        </div>
      </div>
    ),
    { ...size }
  );
}
