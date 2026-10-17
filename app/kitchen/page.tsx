import KitchenLoader from "@/components/kitchen/KitchenLoader";

export const metadata = { title: "Cucina – MenuBridge" };

export default function KitchenPage() {
  return (
    <main className="w-full px-6 py-8 lg:px-10">
      <KitchenLoader />
    </main>
  );
}
