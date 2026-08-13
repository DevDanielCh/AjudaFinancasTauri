import type { ReactFormExtendedApi } from "@tanstack/react-form";

export type CrudFormApi<F> = ReactFormExtendedApi<
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
