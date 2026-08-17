"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { CategoriaAddForm } from "@/src/OrganizacaoFinanceira/Views/Categoria/CategoriaAddForm";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { categoryKeys } from "@/src/OrganizacaoFinanceira/Services/category";
import { categorySchema } from "@/lib/schemas";
import type { CategoryInput } from "@/src/OrganizacaoFinanceira/Models/category";

export default function CategoriesPage() {
  return (
    <CrudPage
      config={{
        title: "Categorias",
        columns: [
          {
            label: "Cor",
            name: "color",
            render: (r) => <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: r.color }} />,
          },
          { label: "Nome", name: "name", render: (r) => r.name },
          { label: "Tipo", name: "type", render: (r) => (r.type === 1 ? "Receita" : "Despesa") },
        ],
        mobileCorners: {
          topLeft: (r) => (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border" style={{ backgroundColor: r.color }} />
              {r.name}
            </span>
          ),
          topRight: (r) => (r.type === 1 ? "Receita" : "Despesa"),
        },
        load: categoryApi.list,
        create: categoryApi.create,
        update: (id, d) => categoryApi.update(id, d),
        remove: categoryApi.remove,
        empty: (): CategoryInput => ({ name: "", type: 2, color: "#6b7280", icon: null }),
        toInput: (r): CategoryInput => ({ name: r.name, type: r.type, color: r.color, icon: r.icon }),
        FormFields: CategoriaAddForm,
        queryKey: categoryKeys,
        invalidate: [["transactions"], ["dashboard"], ["chart-data"]],
        schema: categorySchema,
      }}
    />
  );
}
