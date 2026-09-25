"use client";
import { CreditCard, Wallet } from "lucide-react";
import { PaymentMethodsScreen } from "@/components/screens/payment-methods";
import { Badge } from "@/components/ui/badge";
import { FormaPagamentoAddForm } from "@/src/OrganizacaoFinanceira/Views/FormaPagamento/FormaPagamentoAddForm";
import { FormaPagamentoViewForm } from "@/src/OrganizacaoFinanceira/Views/FormaPagamento/FormaPagamentoViewForm";
import { paymentMethodApi } from "@/src/OrganizacaoFinanceira/Repositories/payment-method";
import { paymentMethodKeys } from "@/src/OrganizacaoFinanceira/Services/payment-method";
import { paymentMethodSchema } from "@/lib/schemas";
import type { PaymentMethodInput } from "@/src/OrganizacaoFinanceira/Models/payment-method";

export default function PaymentMethodsPage() {
  return (
    <PaymentMethodsScreen
      config={{
        title: "Formas de Pagamento",
        newTitle: "Nova Forma de Pagamento",
        editTitle: "Editar Forma de Pagamento",
        columns: [
          {
            label: "Nome",
            name: "name",
            render: (r) => (
              <span className="flex min-w-0 items-center gap-1.5">
                {r.type === 2 ? (
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sticker-sky/15 text-sticker-sky">
                    <CreditCard className="size-3" />
                  </span>
                ) : (
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Wallet className="size-3" />
                  </span>
                )}
                <span className="truncate">{r.name}</span>
              </span>
            ),
          },
          {
            label: "Tipo",
            name: "type",
            filterId: "type",
            align: "center",
            render: (r) =>
              r.type === 2 ? (
                <Badge variant="info">
                  <CreditCard />
                  Cartão
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Wallet />
                  Padrão
                </Badge>
              ),
          },
          {
            label: "Fechamento/Vencimento",
            align: "center",
            render: (r) => {
              if (r.type !== 2) return "—";
              try {
                const m = r.metadata ? JSON.parse(r.metadata) : null;
                return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
              } catch { return "—"; }
            },
          },
        ],
        mobileCorners: {
          topLeft: (r) => (
            <span className="flex min-w-0 items-center gap-1.5">
              {r.type === 2 ? (
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sticker-sky/15 text-sticker-sky">
                  <CreditCard className="size-3" />
                </span>
              ) : (
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Wallet className="size-3" />
                </span>
              )}
              <span className="truncate">{r.name}</span>
            </span>
          ),
          bottomLeft: (r) => (r.type === 2 ? "Cartão" : "Padrão"),
          bottomRight: (r) => {
            if (r.type !== 2) return "—";
            try {
              const m = r.metadata ? JSON.parse(r.metadata) : null;
              return m?.close_day ? `${m.close_day}/${m.validity_day ?? "?"}` : "—";
            } catch { return "—"; }
          },
        },
        load: paymentMethodApi.list,
        create: paymentMethodApi.create,
        update: (id, d) => paymentMethodApi.update(id, d),
        remove: paymentMethodApi.remove,
        empty: (): PaymentMethodInput => ({ name: "", type: 1, close_day: null, validity_day: null }),
        toInput: (r): PaymentMethodInput => {
          const m = r.metadata ? JSON.parse(r.metadata) : null;
          return {
            name: r.name, type: r.type,
            close_day: r.type === 2 ? (m?.close_day ?? null) : null,
            validity_day: r.type === 2 ? (m?.validity_day ?? null) : null,
          };
        },
        FormFields: FormaPagamentoAddForm,
        ViewFields: FormaPagamentoViewForm,
        queryKey: paymentMethodKeys,
        invalidate: [["transactions"], ["fixed-bills"], ["dashboard"]],
        schema: paymentMethodSchema,
        emptyTitle: "Nenhuma forma de pagamento",
        emptyDescription: "Adicione cartões, PIX ou outras formas",
        filters: [
          {
            id: "type", label: "Tipo", field: "select",
            options: [
              { label: "Padrão", value: 1 },
              { label: "Cartão", value: 2 },
            ],
            accessor: (r) => r.type,
          },
        ],
      }}
    />
  );
}
