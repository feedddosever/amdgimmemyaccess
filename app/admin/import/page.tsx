import { ImportLoader } from "@/components/Loaders";

export const metadata = { title: "Import a menu – MenuBridge", robots: { index: false } };

export default function AdminImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Import a restaurant&apos;s menu</h1>
        <p className="max-w-2xl text-muted">
          Paste the printed menu. Gemma 4 drafts the dishes and an ingredient sheet with suggested allergens; the owner
          checks every dish before it is approved.
        </p>
      </header>
      <ImportLoader />
    </main>
  );
}
