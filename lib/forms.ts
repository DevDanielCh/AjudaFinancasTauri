import type { FormApi } from "@tanstack/react-form";

export type CrudFormApi<F> = FormApi<
  F,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>;

export { useStore } from "@tanstack/react-form";
