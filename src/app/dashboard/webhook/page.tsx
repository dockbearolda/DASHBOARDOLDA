"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Webhook,
  Copy,
  CheckCheck,
  PlayCircle,
  Code2,
  Shield,
  Info,
} from "lucide-react";
import { toast } from "sonner";

const EXAMPLE_PAYLOAD = {
  commande: "CMD-2025-001",
  nom: "DUPONT",
  prenom: "Marie",
  telephone: "+33 6 12 34 56 78",
  limit: "2025-03-15T10:00:00Z",
  paiement: { statut: "OUI" },
  prix: { total: 149.99 },
  articles: [
    {
      reference: "H-001",
      taille: "L",
      note: "Pas de logo sur la manche",
      collection: "Homme Été",
      fiche: {
        visuelAvant:  "bea-16-av-AV",
        visuelArriere: "bea-16-av-AR",
        tailleDTFAr:  "A4",
        typeProduit:  "T-Shirt",
        couleur:      "Blanc",
        positionLogo: "Poitrine gauche",
      },
      prt: {
        refPrt:    "PRT-001",
        taillePrt: "A4",
        quantite:  1,
      },
      prix: { tshirt: 29.99, personnalisation: 120.00 },
    },
  ],
};

export default function WebhookPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/orders`
      : "/api/orders";

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copié dans le presse-papiers");
    setTimeout(() => setCopied(null), 2000);
  };

  const testWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/orders/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: `Commande créée: #${data.order?.orderNumber}` });
        toast.success("Webhook testé avec succès !");
      } else {
        setTestResult({ ok: false, message: data.error || "Erreur inconnue" });
        toast.error("Erreur lors du test");
      }
    } catch {
      setTestResult({ ok: false, message: "Connexion impossible" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <Header title="Webhook" />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration Webhook</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intégrez vos commandes depuis oldastudio.up.railway.app
          </p>
        </div>

        {/* Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Endpoint POST
            </CardTitle>
            <CardDescription>
              Configurez cette URL dans votre boutique comme destination webhook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={`${webhookUrl}`}
                readOnly
                className="font-mono text-sm bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copy(webhookUrl, "url")}
              >
                {copied === "url" ? (
                  <CheckCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-3">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-1">Sécurisation</p>
                <p>
                  Définissez la variable d&apos;environnement{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                    WEBHOOK_SECRET
                  </code>{" "}
                  et envoyez-la dans l&apos;en-tête{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                    X-Webhook-Secret
                  </code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payload format */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              Format du payload JSON
            </CardTitle>
            <CardDescription>Exemple de données attendues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="rounded-xl bg-muted/60 p-4 text-xs font-mono overflow-auto max-h-96 text-foreground/80 leading-relaxed">
                {JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-3 top-3"
                onClick={() => copy(JSON.stringify(EXAMPLE_PAYLOAD, null, 2), "payload")}
              >
                {copied === "payload" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fields reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Champs disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { field: "commande",  type: "string", required: true,  desc: "Numéro unique de commande (ex: CMD-2025-001)" },
                { field: "nom",      type: "string", required: true,  desc: "Nom de famille du client" },
                { field: "prenom",   type: "string", required: false, desc: "Prénom du client" },
                { field: "telephone",type: "string", required: false, desc: "Téléphone du client" },
                { field: "limit",    type: "string", required: false, desc: "Date limite ISO 8601 (ex: 2025-03-15T10:00:00Z)" },
                { field: "paiement.statut", type: "enum", required: false, desc: "OUI | NON | PAID | PENDING" },
                { field: "prix.total", type: "number", required: false, desc: "Montant total (en euros)" },
                { field: "articles", type: "array",  required: false, desc: "Liste des articles (si absent, champs racine utilisés)" },
                { field: "articles[].fiche.typeProduit", type: "string", required: false, desc: "Famille produit (T-Shirt, Sweat…)" },
                { field: "articles[].fiche.couleur",     type: "string", required: false, desc: "Couleur du vêtement" },
                { field: "articles[].fiche.tailleDTFAr", type: "string", required: false, desc: "Taille du film DTF (A4, A3+5cm…)" },
                { field: "articles[].fiche.visuelAvant", type: "string", required: false, desc: "URL ou code DTF face avant" },
                { field: "articles[].fiche.visuelArriere", type: "string", required: false, desc: "URL ou code DTF face arrière" },
                { field: "articles[].note",              type: "string", required: false, desc: "Note client pour cet article" },
                { field: "articles[].prt.refPrt",        type: "string", required: false, desc: "Référence impression PRT" },
              ].map((f) => (
                <div key={f.field} className="flex items-start gap-3 py-2">
                  <code className="text-xs font-mono text-foreground w-40 shrink-0">
                    {f.field}
                  </code>
                  <Badge variant={f.required ? "default" : "secondary"} className="text-[10px] h-5 shrink-0">
                    {f.required ? "requis" : "optionnel"}
                  </Badge>
                  <span className="text-muted-foreground text-xs">{f.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              Tester l&apos;intégration
            </CardTitle>
            <CardDescription>
              Envoie une commande de test pour vérifier la connexion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testWebhook} disabled={testing}>
              <PlayCircle className="h-4 w-4" />
              {testing ? "Test en cours..." : "Envoyer une commande test"}
            </Button>

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-sm ${
                  testResult.ok
                    ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300"
                }`}
              >
                <span>{testResult.ok ? "✓" : "✗"}</span>
                <span>{testResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
