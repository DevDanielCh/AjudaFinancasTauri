"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, scrollable, children, ...props }: React.ComponentProps<"table"> & { scrollable?: boolean }) {
  if (scrollable) {
    return (
      <div
        data-slot="table-container"
        className={cn("overflow-hidden rounded-md border", className)}
      >
        <div
          data-slot="table-scroll"
          className="overflow-y-auto"
        >
          <table
            data-slot="table"
            className="w-full caption-bottom border-separate border-spacing-x-0 border-spacing-y-0 text-sm"
            {...props}
          >
            {children}
          </table>
        </div>
      </div>
    );
  }
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-hidden rounded-md border", className)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-separate border-spacing-x-0 text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, scrollable, ...props }: React.ComponentProps<"thead"> & { scrollable?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b",
        scrollable && "sticky top-0 z-10 bg-card",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child>td]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-colors [&>td]:border-b [&>td]:border-border hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, scrollable, ...props }: React.ComponentProps<"th"> & { scrollable?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-sm text-left align-middle font-semibold whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        scrollable && "sticky top-0 z-10 bg-card",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
