import { AmdPanelLoader } from "@/components/Loaders";

export const metadata = { title: "AMD panel – MenuBridge" };

export default function MetricsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col px-4 py-10">
      <AmdPanelLoader />
    </main>
  );
}
