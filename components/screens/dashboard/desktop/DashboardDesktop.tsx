"use client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardError } from "../shared/DashboardError";
import { DashboardSections } from "../shared/DashboardSections";
import type { DashboardScreenProps } from "../types";

export function DashboardDesktop(props: DashboardScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-4">
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          disabled={props.isFetching}
          onClick={() => void props.onSync()}
        >
          <RefreshCw data-icon="inline-start" className={cn(props.isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>
      {props.data ? (
        <DashboardSections month={props.month} data={props.data} chart={props.chart} />
      ) : (
        <DashboardError onRetry={props.onRetry} />
      )}
    </div>
  );
}