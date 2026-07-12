import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cached: string | null = null;

// public/logo.png is the transparent-background source art -- shared by
// app/icon.tsx and app/apple-icon.tsx, both of which composite it onto a
// white background themselves (a maskable/home-screen icon shouldn't have
// transparency: it gets cropped to a shape by the OS, and a see-through
// background looks broken).
export async function getLogoDataUri(): Promise<string> {
  if (!cached) {
    const data = await readFile(join(process.cwd(), "public", "logo.png"), "base64");
    cached = `data:image/png;base64,${data}`;
  }
  return cached;
}
