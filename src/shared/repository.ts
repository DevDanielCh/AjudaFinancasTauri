import { invoke } from "@tauri-apps/api/core";
import type { ChartData, DashboardData, Settings, SettingsInput } from "./models";

export const getEarliestMonth = () => invoke<string>("get_earliest_month");
export const getVersion = () => invoke<string>("get_version");
export const getSettings = () => invoke<Settings>("get_settings");
export const updateSettings = (input: SettingsInput) => invoke<void>("update_settings", { input });
export const getDashboard = (month: string) => invoke<DashboardData>("get_dashboard", { month });
export const syncDashboard = (month: string) => invoke<DashboardData>("sync_dashboard", { month });
export const revalidateGenerated = () => invoke<void>("revalidate_generated_transactions");
export const getChartData = (month: string | null) => invoke<ChartData>("get_chart_data", { month });

export function msg(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : "Erro desconhecido";
}

export const sharedApi = {
  getEarliestMonth,
  getVersion,
  getSettings,
  updateSettings,
  getDashboard,
  syncDashboard,
  revalidateGenerated,
  getChartData,
};
