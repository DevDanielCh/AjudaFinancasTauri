import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  sortValue?: (row: T) => string | number;
}

export interface MobileCorners<T> {
  topLeft: (row: T) => ReactNode;
  bottomLeft?: (row: T) => ReactNode;
  topRight?: (row: T) => ReactNode;
  bottomRight?: (row: T) => ReactNode;
}
