import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "default" | "lg" | number
}) {
  const nativeSize = typeof size === "number" ? size : undefined
  const variant = typeof size === "number" ? "default" : size
  return (
    <InputPrimitive
      type={type}
      size={nativeSize}
      data-slot="input"
      data-size={variant}
      className={cn(
        "w-full min-w-0 rounded-sm border border-input bg-transparent text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:shadow-xs disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[size=default]:h-8 data-[size=default]:px-2.5 data-[size=default]:py-1 data-[size=lg]:h-11 data-[size=lg]:rounded-md data-[size=lg]:px-3.5 data-[size=lg]:text-base data-[size=lg]:md:text-base",
        className
      )}
      {...props}
    />
  )
}

export { Input }
