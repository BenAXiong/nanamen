import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Nanamen",
  description: "Amis (Malan) sentence review — Exposure and Fluency practice",
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      // The theme script below adds/removes "dark" here before hydration,
      // which never matches the server-rendered class list -- expected, not
      // a real mismatch.
      suppressHydrationWarning
    >
      <head>
        {/* Blocking (not deferred): must run before first paint so there's no
            flash of the wrong theme. Defaults to dark -- see ThemeToggle.tsx --
            unless "nanamen-theme" in localStorage says "light". */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nanamen-theme");if(t==="light"){document.documentElement.classList.remove("dark")}else{document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}})();`,
          }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. asbplayer) inject
          attributes into <body> before hydration; not a real mismatch. */}
      <body
        className="flex min-h-full flex-col bg-stone-50 dark:bg-stone-950"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
