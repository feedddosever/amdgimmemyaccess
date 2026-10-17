// Cache Components: params of a dynamic segment are runtime data unless
// generateStaticParams lists them, so the demo menu is prerendered here.
export function generateStaticParams() {
  return [{ restaurantId: "demo-trattoria" }];
}

export default async function DinerMenuPage({ params }: PageProps<"/m/[restaurantId]">) {
  const { restaurantId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Menu: {restaurantId}</h1>
      <p className="text-sm text-zinc-500">
        Placeholder diner menu — personalised menu in P5, ordering in P6.
      </p>
    </main>
  );
}
