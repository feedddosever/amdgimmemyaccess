import Link from "next/link";

const pages = [
  { href: "/m/demo-trattoria", label: "Diner menu (demo trattoria)" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/demo", label: "Demo split screen" },
  { href: "/metrics", label: "AMD panel" },
  { href: "/about", label: "How it works" },
  { href: "/admin/import", label: "Import a menu" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">MenuBridge</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Order in your language. The kitchen gets it in theirs.
      </p>
      <p className="text-sm text-zinc-500">Placeholder landing page — built in P11.</p>
      <ul className="flex flex-col gap-2">
        {pages.map((page) => (
          <li key={page.href}>
            <Link className="underline underline-offset-4" href={page.href}>
              {page.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
