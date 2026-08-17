"use client";
import type { ReservaInput } from "../../Models/reserva";
import type { CrudFormApi } from "@/lib/forms";
import { ReservaAddForm } from "./ReservaAddForm";

export function ReservaEditForm({
  form,
  serverError,
}: {
  form: CrudFormApi<ReservaInput>;
  serverError: string | null;
}) {
  return <ReservaAddForm form={form} resources={undefined} serverError={serverError} />;
}
