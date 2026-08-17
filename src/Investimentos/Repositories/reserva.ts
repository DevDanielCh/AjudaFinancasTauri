import { invoke } from "@tauri-apps/api/core";
import type { ReservaRow } from "../Models/reserva";

export const reservaApi = {
  listMovements: () => invoke<ReservaRow[]>("list_reserva_movements"),
};
