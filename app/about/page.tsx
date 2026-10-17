import BenchSection from "@/components/BenchSection";
import { getBenchResults } from "@/lib/bench";

export const metadata = { title: "How it works – MenuBridge" };

export default async function AboutPage() {
  const results = await getBenchResults();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">How MenuBridge works</h1>
        <p className="text-sm text-muted">The full explanation and track compliance arrive in P11.</p>
      </header>
      <section aria-labelledby="bench-title" className="flex flex-col gap-3">
        <h2 id="bench-title" className="text-2xl font-semibold">
          Benchmark on AMD Instinct MI300X
        </h2>
        <BenchSection results={results} />
      </section>
    </main>
  );
}
