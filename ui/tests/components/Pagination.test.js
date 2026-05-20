import { createPaginationController } from '../../src/components/Pagination.js';

describe('createPaginationController', () => {
  const onPageChange = jest.fn();

  beforeEach(() => onPageChange.mockClear());

  test('shows "No results" when total is 0', () => {
    const ctrl = createPaginationController({ page: 1, total: 0, onPageChange });
    expect(ctrl.showingText).toBe('No results');
  });

  test('shows correct range for first page', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    expect(ctrl.showingText).toBe('Showing 1 to 10 of 25 results');
  });

  test('shows correct range for second page', () => {
    const ctrl = createPaginationController({ page: 2, total: 25, perPage: 10, onPageChange });
    expect(ctrl.showingText).toBe('Showing 11 to 20 of 25 results');
  });

  test('shows correct range for last partial page', () => {
    const ctrl = createPaginationController({ page: 3, total: 25, perPage: 10, onPageChange });
    expect(ctrl.showingText).toBe('Showing 21 to 25 of 25 results');
  });

  test('hasPages is false when only one page', () => {
    const ctrl = createPaginationController({ page: 1, total: 5, perPage: 10, onPageChange });
    expect(ctrl.hasPages).toBe(false);
  });

  test('hasPages is true when multiple pages', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    expect(ctrl.hasPages).toBe(true);
  });

  test('prevDisabled is truthy on first page', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    expect(ctrl.prevDisabled).toBeTruthy();
  });

  test('nextDisabled is truthy on last page', () => {
    const ctrl = createPaginationController({ page: 3, total: 25, perPage: 10, onPageChange });
    expect(ctrl.nextDisabled).toBeTruthy();
  });

  test('prevDisabled is falsy on middle pages', () => {
    const ctrl = createPaginationController({ page: 2, total: 25, perPage: 10, onPageChange });
    expect(ctrl.prevDisabled).toBeFalsy();
  });

  test('generates correct number of page buttons', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    expect(ctrl.pages).toHaveLength(3);
  });

  test('current page button has active class', () => {
    const ctrl = createPaginationController({ page: 2, total: 25, perPage: 10, onPageChange });
    expect(ctrl.pages[1].btnClass).toContain('border-secondary');
    expect(ctrl.pages[0].btnClass).not.toContain('border-secondary');
  });

  test('prevPage calls onPageChange with page - 1', () => {
    const ctrl = createPaginationController({ page: 2, total: 25, perPage: 10, onPageChange });
    ctrl.prevPage();
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  test('nextPage calls onPageChange with page + 1', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    ctrl.nextPage();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('prevPage does nothing on first page', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    ctrl.prevPage();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test('nextPage does nothing on last page', () => {
    const ctrl = createPaginationController({ page: 3, total: 25, perPage: 10, onPageChange });
    ctrl.nextPage();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  test('page buttons have correct labels', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    expect(ctrl.pages.map(p => p.label)).toEqual(['1', '2', '3']);
  });

  test('page button go() calls onPageChange with correct page', () => {
    const ctrl = createPaginationController({ page: 1, total: 25, perPage: 10, onPageChange });
    ctrl.pages[2].go();
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
