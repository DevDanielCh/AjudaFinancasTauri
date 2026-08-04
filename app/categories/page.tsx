"use client";
import { CrudPage } from "@/components/crud/CrudPage";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { api } from "@/lib/api";
import type { Category, CategoryInput } from "@/lib/types";

export default function CategoriesPage() {
  return (
    <CrudPage
      config={{
        title: "Categorias",
        columns: [
          {
            header: "Cor",
            render: (r) => <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: r.color }} />,
          },
          { header: "Nome", render: (r) => r.name },
          { header: "Tipo", render: (r) => (r.type === 1 ? "Receita" : "Despesa") },
        ],
        load: api.listCategories,
        create: api.createCategory,
        update: (id, d) => api.updateCategory(id, d),
        remove: api.deleteCategories,
        empty: (): CategoryInput => ({ name: "", type: 2, color: "#6b7280", icon: null }),
        toInput: (r): CategoryInput => ({ name: r.name, type: r.type, color: r.color, icon: r.icon }),
        loadResources: async () => ({}),
        FormFields: CategoryForm,
      }}
    />
  );
}
