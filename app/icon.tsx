import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f59e0b",
          fontSize: 300,
          fontWeight: 700,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        那
      </div>
    ),
    { ...size },
  );
}
