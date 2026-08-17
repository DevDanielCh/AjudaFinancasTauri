"use client";
import type { CategoryInput } from "../../Models/category";
import type { CrudFormApi } from "@/lib/forms";
import { CategoriaAddForm } from "./CategoriaAddForm";

export function CategoriaEditForm({
  form,
  serverError,
}: {
  form: CrudFormApi<CategoryInput>;
  serverError: string | null;
}) {
  return <CategoriaAddForm form={form} serverError={serverError} />;
}
