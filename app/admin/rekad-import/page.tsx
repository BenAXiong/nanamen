import { notFound } from "next/navigation";
import { Screen, ScreenHeader } from "@/components/Screen";
import { RekadImportButton } from "@/components/RekadImportButton";

export const dynamic = "force-dynamic";

export default function RekadImportPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <Screen>
      <ScreenHeader title="Rekad import" subtitle="SashaWaves → Airtable" backHref="/" />
      <p className="mb-4 text-sm text-stone-500 dark:text-stone-400">
        Checks the current max &ldquo;Rekad N&rdquo; lesson in Airtable, then imports the next one from
        SashaWaves if it&apos;s available. Never re-imports or overwrites an existing lesson.
      </p>
      <RekadImportButton />
    </Screen>
  );
}
