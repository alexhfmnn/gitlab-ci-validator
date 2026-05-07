import { describe, expect, it } from 'vitest';
import { errorMessage, isPlainObject, isStringArray } from '../../lib/typeGuards';

describe('isPlainObject', () => {
  it('accepts plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('rejects null, arrays, primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
    expect(isPlainObject('str')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

describe('isStringArray', () => {
  it('accepts arrays of strings', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a', 'b'])).toBe(true);
  });

  it('rejects mixed arrays and non-arrays', () => {
    expect(isStringArray([1, 'a'])).toBe(false);
    expect(isStringArray('not array')).toBe(false);
    expect(isStringArray(null)).toBe(false);
  });
});

describe('errorMessage', () => {
  it('extracts Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns string inputs unchanged', () => {
    expect(errorMessage('plain')).toBe('plain');
  });

  it('coerces other shapes via String()', () => {
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage({ toString: () => 'obj' })).toBe('obj');
  });
});
