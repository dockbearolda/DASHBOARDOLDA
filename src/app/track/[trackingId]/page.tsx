import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TrackingClient from "./TrackingClient";

export const dynamic = "force-dynamic";

type PlanningStatus =
  | "A_DEVISER"
  | "ATTENTE_VALIDATION"
  | "MAQUETTE_A_FAIRE"
  | "ATTENTE_MARCHANDISE"
  | "A_PREPARER"
  | "A_PRODUIRE"
  | "EN_PRODUCTION"
  | "A_MONTER_NETTOYER"
  | "MANQUE_INFORMATION"
  | "TERMINE"
  | "PREVENIR_CLIENT"
  | "CLIENT_PREVENU"
  | "RELANCE_CLIENT"
  | "PRODUIT_RECUPERE"
  | "A_FACTURER"
  | "FACTURE_FAITE";

export interface TrackingData {
  trackingId: string;
  clientName: string;
  designation: string;
  quantity: number;
  status: PlanningStatus;
  deadline: string | null;
  createdAt: string;
}

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ trackingId: string }>;
}) {
  const { trackingId } = await params;

  const item = await prisma.planningItem.findUnique({
    where: { trackingId },
    select: {
      trackingId: true,
      clientName: true,
      designation: true,
      quantity: true,
      status: true,
      deadline: true,
      createdAt: true,
    },
  });

  if (!item || !item.trackingId) {
    notFound();
  }

  const data: TrackingData = {
    trackingId: item.trackingId,
    clientName: item.clientName,
    designation: item.designation,
    quantity: item.quantity,
    status: item.status as PlanningStatus,
    deadline: item.deadline?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };

  return <TrackingClient initialData={data} />;
}
