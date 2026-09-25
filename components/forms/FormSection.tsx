import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

export function FormSection({
  title,
  icon: Icon,
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section data-slot="form-section" className={cn("flex flex-col gap-4", className)}>
      {title && (
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
          <span className="text-sm font-semibold">{title}</span>
          <Separator className="flex-1" />
        </div>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}