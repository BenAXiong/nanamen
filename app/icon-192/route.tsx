import { ImageResponse } from "next/og";
import { getLogoDataUri } from "@/lib/logo.server";

// A plain Route Handler rather than the `icon` file convention -- Next
// only auto-wires one `icon.tsx` per segment, and Chrome's installability
// criteria wants both a 192px and a 512px icon in the manifest (see
// manifest.ts), not just the 512px one `icon.tsx` already provides.
export async function GET() {
  const logoSrc = await getLogoDataUri();
  const size = 192;
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
        <img src={logoSrc} width={165} height={165} />
      </div>
    ),
    { width: size, height: size },
  );
}
