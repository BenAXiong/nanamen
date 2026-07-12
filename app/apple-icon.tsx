import { ImageResponse } from "next/og";
import { getLogoDataUri } from "@/lib/logo.server";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies no mask/crop of its own to the home-screen icon, so unlike
// icon.tsx there's no "safe zone" padding to leave -- fill the frame.
export default async function AppleIcon() {
  const logoSrc = await getLogoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <img src={logoSrc} width={160} height={160} />
      </div>
    ),
    { ...size },
  );
}
