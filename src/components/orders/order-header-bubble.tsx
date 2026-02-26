'use client';

import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrderFiche {
  tailleDTFAr?: string;
  [key: string]: any;
}

interface Order {
  commande: string;
  prenom: string;
  nom: string;
  telephone?: string | null;
  deadline?: Date | string | null;
  fiche?: OrderFiche | null;
}

interface OrderHeaderBubbleProps {
  order: Order;
}

export function OrderHeaderBubble({ order }: OrderHeaderBubbleProps) {
  // Format deadline
  const formatDeadline = (deadline: Date | string | null | undefined) => {
    if (!deadline) return null;
    try {
      const date = typeof deadline === 'string' ? new Date(deadline) : deadline;
      return format(date, 'dd/MM/yyyy', { locale: fr });
    } catch {
      return null;
    }
  };

  // Build second line with conditional rendering
  const buildSecondLine = () => {
    const parts: string[] = [];

    if (order.telephone) parts.push(order.telephone);
    if (order.deadline) {
      const formatted = formatDeadline(order.deadline);
      if (formatted) parts.push(formatted);
    }
    if (order.fiche?.tailleDTFAr) parts.push(order.fiche.tailleDTFAr);

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const secondLine = buildSecondLine();

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
      {/* QR Code - Left */}
      <div className="flex-shrink-0">
        <QRCodeSVG
          value={order.commande}
          size={100}
          level="H"
          includeMargin={true}
        />
      </div>

      {/* Content - Right */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Line 1: Name */}
        <div className="font-bold text-gray-900 uppercase text-base">
          {order.prenom} {order.nom}
        </div>

        {/* Line 2: Details */}
        {secondLine && (
          <div className="text-sm text-gray-500">
            {secondLine}
          </div>
        )}
      </div>
    </div>
  );
}
