export type Id = string;

export type TimestampLike = Date | string | number;

export type SortDirection = "asc" | "desc";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface QueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: SortDirection;
}

export interface SelectOption<T extends string = string> {
  label: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface OperationResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}
