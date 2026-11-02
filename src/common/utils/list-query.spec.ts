import { SelectQueryBuilder } from 'typeorm';
import { AppException } from '../exceptions/app.exception';
import { applySearch, applySort, escapeLike, searchTerms } from './list-query';
import { paginate } from './paginate';

function fakeQb() {
  const calls: { method: string; args: unknown[] }[] = [];
  const qb = {
    alias: 'u',
    andWhere: (...args: unknown[]) => (calls.push({ method: 'andWhere', args }), qb),
    orderBy: (...args: unknown[]) => (calls.push({ method: 'orderBy', args }), qb),
    addOrderBy: (...args: unknown[]) => (calls.push({ method: 'addOrderBy', args }), qb),
  };
  return { qb: qb as unknown as SelectQueryBuilder<object>, calls };
}

describe('list query helpers', () => {
  it('escapes LIKE wildcards so users search literally', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('splits search into at most five words', () => {
    expect(searchTerms('  arun   prakash ')).toEqual(['arun', 'prakash']);
    expect(searchTerms('a b c d e f g')).toHaveLength(5);
    expect(searchTerms(undefined)).toEqual([]);
  });

  it('adds one condition per search word', () => {
    const { qb, calls } = fakeQb();
    applySearch(qb, 'arun prak', ['u.name', 'u.mobile']);
    expect(calls.filter((call) => call.method === 'andWhere')).toHaveLength(2);
  });

  it('adds nothing when search is empty', () => {
    const { qb, calls } = fakeQb();
    applySearch(qb, '', ['u.name']);
    expect(calls).toHaveLength(0);
  });

  it('sorts by the default column with id as tie-breaker', () => {
    const { qb, calls } = fakeQb();
    applySort(qb, { order: 'desc' }, { sortable: { created_at: 'u.created_at' }, defaultSort: 'created_at' });
    expect(calls).toEqual([
      { method: 'orderBy', args: ['u.created_at', 'DESC', 'NULLS LAST'] },
      { method: 'addOrderBy', args: ['u.id', 'DESC'] },
    ]);
  });

  it('rejects a sort field that is not allowed', () => {
    const { qb } = fakeQb();
    expect(() =>
      applySort(qb, { sort: 'mobile', order: 'asc' }, { sortable: { name: 'u.name' }, defaultSort: 'name' }),
    ).toThrow(AppException);
  });

  it('paginates with total_pages and has_next', () => {
    expect(paginate([[1, 2], 45], 2, 20)).toEqual({
      items: [1, 2],
      total: 45,
      page: 2,
      limit: 20,
      total_pages: 3,
      has_next: true,
    });
    expect(paginate([[], 0], 1, 20)).toMatchObject({ total_pages: 0, has_next: false });
  });
});
