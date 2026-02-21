export type OrderStatus =
  | "COMMANDE_A_TRAITER"
  | "COMMANDE_EN_ATTENTE"
  | "COMMANDE_A_PREPARER"
  | "MAQUETTE_A_FAIRE"
  | "PRT_A_FAIRE"
  | "EN_ATTENTE_VALIDATION"
  | "EN_COURS_IMPRESSION"
  | "PRESSAGE_A_FAIRE"
  | "CLIENT_A_CONTACTER"
  | "CLIENT_PREVENU"
  | "ARCHIVES";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface OrderItem {
  id: string;
  orderId: string;
  name: string;
  sku?: string | null;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

export interface Address {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  state?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  currency: string;
  notes?: string | null;
  shippingAddress?: Address | null;
  billingAddress?: Address | null;
  items: OrderItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  shippedOrders: number;
  paidOrders: number;
  todayOrders: number;
  todayRevenue: number;
}

export interface WebhookOrderPayload {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  total: number;
  subtotal: number;
  shipping?: number;
  tax?: number;
  currency?: string;
  notes?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  items: {
    name: string;
    sku?: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }[];
}
