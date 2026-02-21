import { Badge } from "@/components/ui/badge";
import { OrderStatus, PaymentStatus } from "@/types/order";
import {
  Clock,
  Loader2,
  CheckCircle2,
  CreditCard,
  AlertCircle,
  RotateCcw,
  Package,
  Pencil,
  Printer,
  Eye,
  Layers,
  PhoneCall,
  Archive,
} from "lucide-react";

const orderStatusConfig: Record<
  OrderStatus,
  {
    label: string;
    variant: "warning" | "info" | "purple" | "success" | "destructive" | "default";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  COMMANDE_EN_ATTENTE:   { label: "Commande en Attente",    variant: "warning",     icon: Clock },
  COMMANDE_A_PREPARER:   { label: "Commande à préparer",    variant: "info",        icon: Package },
  MAQUETTE_A_FAIRE:      { label: "Maquette à faire",       variant: "purple",      icon: Pencil },
  PRT_A_FAIRE:           { label: "PRT à faire",            variant: "warning",     icon: Printer },
  EN_ATTENTE_VALIDATION: { label: "En attente validation",  variant: "info",        icon: Eye },
  EN_COURS_IMPRESSION:   { label: "En cours d'Impression",  variant: "info",        icon: Loader2 },
  PRESSAGE_A_FAIRE:      { label: "Pressage à faire",       variant: "purple",      icon: Layers },
  CLIENT_A_CONTACTER:    { label: "Client à contacter",     variant: "destructive", icon: PhoneCall },
  CLIENT_PREVENU:        { label: "Client prévenu",         variant: "success",     icon: CheckCircle2 },
  ARCHIVES:              { label: "Archives",               variant: "default",     icon: Archive },
};

const paymentStatusConfig: Record<
  PaymentStatus,
  {
    label: string;
    variant: "warning" | "success" | "destructive" | "default";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PENDING: { label: "En attente", variant: "warning", icon: Clock },
  PAID: { label: "Payé", variant: "success", icon: CreditCard },
  FAILED: { label: "Échoué", variant: "destructive", icon: AlertCircle },
  REFUNDED: { label: "Remboursé", variant: "default", icon: RotateCcw },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
