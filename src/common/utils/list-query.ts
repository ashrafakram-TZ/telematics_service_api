import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { ListQueryDto } from '../dto/pagination.dto';
import { AppException } from '../exceptions/app.exception';
import { offset, paginate, Paginated } from './paginate';

export interface ListOptions {
  searchable: string[];
  sortable: Record<string, string>;
  defaultSort: string;
}

const MAX_TERMS = 5;

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function searchTerms(search?: string): string[] {
  if (!search) return [];
  return search.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

export function applySearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  search: string | undefined,
  columns: string[],
): SelectQueryBuilder<T> {
  searchTerms(search).forEach((term, index) => {
    const param = `search_${index}`;
    qb.andWhere(
      new Brackets((where) => {
        columns.forEach((column) => where.orWhere(`${column} ILIKE :${param}`, { [param]: `%${escapeLike(term)}%` }));
      }),
    );
  });
  return qb;
}

export function applySort<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: Pick<ListQueryDto, 'sort' | 'order'>,
  options: Pick<ListOptions, 'sortable' | 'defaultSort'>,
): SelectQueryBuilder<T> {
  const key = query.sort ?? options.defaultSort;
  const column = options.sortable[key];
  if (!column) {
    throw AppException.badRequest(`sort must be one of: ${Object.keys(options.sortable).join(', ')}`, 'INVALID_SORT');
  }
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';
  qb.orderBy(column, direction, 'NULLS LAST');
  if (column !== `${qb.alias}.id`) qb.addOrderBy(`${qb.alias}.id`, direction);
  return qb;
}

export async function listQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: ListQueryDto,
  options: ListOptions,
): Promise<Paginated<T>> {
  applySearch(qb, query.search, options.searchable);
  applySort(qb, query, options);
  qb.skip(offset(query.page, query.limit)).take(query.limit);
  return paginate(await qb.getManyAndCount(), query.page, query.limit);
}
