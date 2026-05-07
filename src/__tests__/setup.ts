import '@testing-library/jest-dom/vitest';

// Node 25 ships a stubbed `localStorage`/`sessionStorage` global that shadows
// jsdom's Storage and lacks `getItem`/`setItem`/`removeItem`/`clear`. Install a
// real Map-backed shim so storage code under test behaves like a browser.
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: new MemoryStorage(),
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  writable: true,
  value: new MemoryStorage(),
});

// jsdom does not provide matchMedia; CodeMirror's theme detection calls it.
globalThis.window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

// jsdom's Range methods that CodeMirror relies on for measurement aren't
// fully implemented; stub them so the editor mounts without throwing.
const emptyRectList: DOMRectList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {
    // empty
  },
} as unknown as DOMRectList;
Range.prototype.getClientRects = () => emptyRectList;
const emptyRect: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  toJSON: () => ({}),
};
Range.prototype.getBoundingClientRect = () => emptyRect;
