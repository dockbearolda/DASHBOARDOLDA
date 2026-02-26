import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/header";
import { OrderDetail } from "@/components/orders/order-detail";
import { Order } from "@/types/order";

interface Props {
  params: Promise<{ id: string }>;
}

async function getOrder(id: string) {
  const raw = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!raw) return null;
  return {
    ...raw,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    deadline:  raw.deadline?.toISOString() ?? null,
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  let order;
  try {
    order = await getOrder(id);
  } catch {
    notFound();
  }

  if (!order) notFound();

  return (
    <div>
      <Header title={`Commande #${order!.orderNumber}`} />
      <div className="p-6">
        <OrderDetail order={order as unknown as Order} />
      </div>
    </div>
  );
}
