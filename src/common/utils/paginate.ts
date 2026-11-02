export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
}

export function paginate<T>([items, total]: [T[], number], page: number, limit: number): Paginated<T> {
  const totalPages = Math.ceil(total / limit);
  return { items, total, page, limit, total_pages: totalPages, has_next: page < totalPages };
}

export function offset(page: number, limit: number): number {
  return (page - 1) * limit;
}
