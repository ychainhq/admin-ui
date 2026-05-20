import { createSearchController } from '../../src/components/SearchBar.js';

jest.useFakeTimers();

describe('createSearchController', () => {
  test('initialises with provided value', () => {
    const ctrl = createSearchController({ value: 'hello', onInput: jest.fn() });
    expect(ctrl.value).toBe('hello');
  });

  test('initialises with empty string by default', () => {
    const ctrl = createSearchController({ onInput: jest.fn() });
    expect(ctrl.value).toBe('');
  });

  test('calls onInput with target value after debounce', () => {
    const onInput = jest.fn();
    const ctrl = createSearchController({ onInput });
    ctrl.onInput({ target: { value: 'bitcoin' } });
    expect(onInput).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(onInput).toHaveBeenCalledWith('bitcoin');
  });

  test('debounces multiple rapid inputs — only last fires', () => {
    const onInput = jest.fn();
    const ctrl = createSearchController({ onInput });
    ctrl.onInput({ target: { value: 'a' } });
    ctrl.onInput({ target: { value: 'ab' } });
    ctrl.onInput({ target: { value: 'abc' } });
    jest.runAllTimers();
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput).toHaveBeenCalledWith('abc');
  });
});
