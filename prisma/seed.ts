import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  for (let i = 1; i <= 20; i++) {
    const refNumber = String(i).padStart(3, "0");
    const reference = `H-${refNumber}`;
    const orderNumber = `CMD-${Date.now()}-${i}`;

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.order.create({
      data: {
        orderNumber,
        customerName:      `Client ${i}`,
        customerFirstName: `Prénom${i}`,
        customerEmail:     `client${i}@example.com`,
        customerPhone:     `06${String(Math.random() * 100000000).padStart(8, "0")}`,
        status:            "COMMANDE_A_TRAITER",
        paymentStatus:     i % 2 === 0 ? "PAID" : "PENDING",
        total:             35 + i * 5,
        subtotal:          30 + i * 5,
        shipping:          5,
        tax:               0,
        currency:          "EUR",
        category:          "t-shirt",
        deadline,
        notes:             `Commande test ${i}`,
        items: {
          create: [
            {
              famille:      "T-Shirt",
              couleur:      "Blanc",
              tailleDTF:    "A4",
              reference,
              taille:       "L",
              collection:   "Homme",
              imageAvant:   `LOGO-${refNumber}-AV`,
              imageArriere: `LOGO-${refNumber}-AR`,
              noteClient:   `Note de test ${i}`,
              prixUnitaire: 35 + i * 5,
            },
          ],
        },
      },
    });

    console.log(`Inséré : ${reference} (${orderNumber})`);
  }

  console.log("Seeding terminé!");
}

main()
  .catch((e) => {
    console.error("Erreur lors du seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
