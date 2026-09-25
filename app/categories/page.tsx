"use client";
import { CategoriesScreen } from "@/components/screens/categories";
import { CategoryChip } from "@/components/crud/CategoryChip";
import { Badge } from "@/components/ui/badge";
import { CategoriaAddForm } from "@/src/OrganizacaoFinanceira/Views/Categoria/CategoriaAddForm";
import { CategoriaViewForm } from "@/src/OrganizacaoFinanceira/Views/Categoria/CategoriaViewForm";
import { categoryApi } from "@/src/OrganizacaoFinanceira/Repositories/category";
import { categoryKeys } from "@/src/OrganizacaoFinanceira/Services/category";
import { categorySchema } from "@/lib/schemas";
import type { CategoryInput } from "@/src/OrganizacaoFinanceira/Models/category";

export default function CategoriesPage() {
  return (
    <CategoriesScreen
      config={{
        title: "Categorias",
        newTitle: "Nova Categoria",
        editTitle: "Editar Categoria",
        columns: [
          {
            label: "Cor",
            name: "color",
            align: "center",
            render: (r) => <CategoryChip color={r.color} icon={r.icon} />,
          },
          { label: "Nome", name: "name", render: (r) => r.name },
          {
            label: "Tipo",
            name: "type",
            filterId: "type",
            align: "center",
            render: (r) =>
              r.type === 1 ? (
                <Badge variant="positive">Receita</Badge>
              ) : (
                <Badge variant="negative">Despesa</Badge>
              ),
          },
        ],
        mobileCorners: {
          topLeft: (r) => (
            <span className="flex min-w-0 items-center gap-2">
              <CategoryChip color={r.color} icon={r.icon} size="sm" />
              <span className="truncate">{r.name}</span>
            </span>
          ),
          topRight: (r) => (r.type === 1 ? "Receita" : "Despesa"),
        },
        load: categoryApi.list,
        create: categoryApi.create,
        update: (id, d) => categoryApi.update(id, d),
        remove: categoryApi.remove,
        empty: (): CategoryInput => ({ name: "", type: 2, color: "#615d59", icon: null }),
        toInput: (r): CategoryInput => ({ name: r.name, type: r.type, color: r.color, icon: r.icon }),
        FormFields: CategoriaAddForm,
        ViewFields: CategoriaViewForm,
        queryKey: categoryKeys,
        invalidate: [["transactions"], ["dashboard"], ["chart-data"]],
        schema: categorySchema,
        emptyTitle: "Nenhuma categoria",
        emptyDescription: "Categorias ajudam a organizar suas transações",
        filters: [
          {
            id: "type", label: "Tipo", field: "select",
            options: [
              { label: "Receita", value: 1 },
              { label: "Despesa", value: 2 },
            ],
            accessor: (r) => r.type,
          },
        ],
      }}
    />
  );
}
