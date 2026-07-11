export function Screen({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6">{children}</div>;
}

export function ScreenHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <header className="flex items-center gap-3 py-4">
      {backHref ? (
        <a
          href={backHref}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          aria-label="Back"
        >
          ←
        </a>
      ) : null}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-stone-900 dark:text-stone-50">{title}</h1>
        {subtitle ? <p className="truncate text-sm text-stone-500 dark:text-stone-400">{subtitle}</p> : null}
      </div>
    </header>
  );
}
