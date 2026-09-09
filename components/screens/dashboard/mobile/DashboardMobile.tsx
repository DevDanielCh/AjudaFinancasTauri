"use client";
import { PullToRefresh } from "@/components/PullToRefresh";
import { DashboardError } from "../shared/DashboardError";
import { DashboardSections } from "../shared/DashboardSections";
import type { DashboardScreenProps } from "../types";

export function DashboardMobile(props: DashboardScreenProps) {
  return (
    <PullToRefresh onRefresh={() => props.onSync()}>
      <div className="flex flex-col gap-4 pb-4">
        {props.data ? (
          <DashboardSections month={props.month} data={props.data} chart={props.chart} />
        ) : (
          <DashboardError onRetry={props.onRetry} />
        )}
      </div>
    </PullToRefresh>
  );
}