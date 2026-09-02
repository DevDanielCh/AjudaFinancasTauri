import { z } from "zod";

export const transactionSchema = z
  .object({
    description: z.string().min(1, "Informe a descrição"),
    amount: z.number().positive("Informe o valor"),
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    date: z.string().min(1, "Informe a data"),
    category_id: z.number().nullable(),
    payment_method_id: z.number().nullable(),
    card_mode: z.union([z.literal(0), z.literal(1)]),
  })
  .refine((v) => v.type !== 2 || v.payment_method_id != null, {
    message: "Selecione a forma de pagamento",
    path: ["payment_method_id"],
  });

export const reservaSchema = z.object({
  description: z.string().min(1, "Informe a descrição"),
  amount: z.number().positive("Informe o valor"),
  type: z.union([z.literal(4), z.literal(5)], { error: "Selecione o tipo" }),
  date: z.string().min(1, "Informe a data"),
  in_principal: z.boolean().default(true),
});

export const fixedBillSchema = z
  .object({
    description: z.string().min(1, "Informe a descrição"),
    amount: z.number().positive("Informe o valor"),
    day: z.number().min(1, "Dia entre 1 e 31").max(31, "Dia entre 1 e 31"),
    category_id: z.number().nullable(),
    payment_method_id: z.number("Selecione a forma de pagamento"),
    start_month: z.string().min(1, "Informe o mês inicial"),
    end_month: z.string().nullable(),
    installments: z.number().min(2, "Mínimo de 2 parcelas").nullable(),
    purchase_date: z.string().nullable(),
  })
  .refine((v) => v.end_month === null || v.end_month >= v.start_month, {
    message: "O mês final deve ser após o inicial",
    path: ["end_month"],
  });

export const loanSchema = z
  .object({
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    description: z.string().min(1, "Informe a descrição"),
    principal: z.number().positive("Informe o valor total"),
    installment: z.number().positive("Informe o valor da parcela"),
    total_installments: z.number().min(2, "Mínimo de 2 parcelas"),
    day: z.number().min(1, "Dia entre 1 e 31").max(31, "Dia entre 1 e 31"),
    start_month: z.string().min(1, "Informe o mês inicial"),
    payment_method_id: z.number("Selecione a forma de pagamento"),
    monthly_rate: z
      .number()
      .min(0, "Taxa entre 0 e 0,99")
      .max(0.99, "Taxa entre 0 e 0,99"),
  })
  .refine((v) => v.installment * v.total_installments >= v.principal, {
    message: "O total das parcelas deve cobrir o valor",
    path: ["installment"],
  });

export const paymentMethodSchema = z
  .object({
    name: z.string().min(1, "Informe o nome"),
    type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
    close_day: z.number().nullable(),
    validity_day: z.number().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 2) {
      if (v.close_day == null) {
        ctx.addIssue({
          code: "custom",
          message: "Informe o dia de fechamento",
          path: ["close_day"],
        });
      }
      if (v.validity_day == null) {
        ctx.addIssue({
          code: "custom",
          message: "Informe o dia de vencimento",
          path: ["validity_day"],
        });
      }
    }
  });

export const categorySchema = z.object({
  name: z.string().min(1, "Informe o nome"),
  type: z.union([z.literal(1), z.literal(2)], { error: "Selecione o tipo" }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  icon: z.string().nullable(),
});
