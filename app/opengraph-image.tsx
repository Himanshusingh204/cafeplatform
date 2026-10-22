import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.name} - ${site.tagline}`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: site.brand.foreground,
          color: site.brand.background,
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              marginRight: "20px",
              borderRadius: "9999px",
              backgroundColor: site.brand.accent,
              display: "flex",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: site.brand.accent,
            }}
          >
            {site.area}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: "104px",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            {site.name}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "28px",
              fontSize: "36px",
              lineHeight: 1.3,
              opacity: 0.75,
            }}
          >
            {site.tagline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "24px",
            opacity: 0.6,
          }}
        >
          <div style={{ display: "flex" }}>{site.phone}</div>
          <div style={{ display: "flex" }}>{site.email}</div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
