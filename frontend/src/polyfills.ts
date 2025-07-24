/**
 * Polyfills for Node.js globals required by Solana packages in the browser
 */

// Polyfill for Node.js 'process' global
(globalThis as any).process = {
  env: {
    NODE_ENV: 'development',
    ...((globalThis as any).process?.env || {})
  },
  version: '18.0.0',
  versions: {
    node: '18.0.0'
  },
  platform: 'browser',
  nextTick: (callback: Function, ...args: any[]) => {
    setTimeout(() => callback(...args), 0);
  },
  cwd: () => '/',
  chdir: () => {},
  umask: () => 0,
  on: () => {},
  once: () => {},
  off: () => {},
  emit: () => false,
  prependListener: () => {},
  prependOnceListener: () => {},
  listeners: () => [],
  binding: () => {},
  exit: () => {},
  kill: () => {},
  pid: 1,
  ppid: 0,
  title: 'browser',
  arch: 'x64',
  argv: ['node'],
  execArgv: [],
  execPath: '/usr/local/bin/node',
  abort: () => {},
  allowedNodeEnvironmentFlags: new Set(),
  assert: () => {},
  features: {},
  getgid: () => 1000,
  setgid: () => {},
  getuid: () => 1000,
  setuid: () => {},
  getgroups: () => [1000],
  setgroups: () => {},
  initgroups: () => {},
  stdout: null,
  stderr: null,
  stdin: null
};

// Polyfill for Node.js 'global' 
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

// Polyfill for Node.js 'Buffer' using browser TextEncoder/TextDecoder
if (typeof (globalThis as any).Buffer === 'undefined') {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  
  (globalThis as any).Buffer = {
    from: (data: any, encoding?: string) => {
      if (typeof data === 'string') {
        return textEncoder.encode(data);
      }
      if (Array.isArray(data)) {
        return new Uint8Array(data);
      }
      return new Uint8Array(data);
    },
    alloc: (size: number, fill?: any) => {
      const buf = new Uint8Array(size);
      if (fill !== undefined) {
        buf.fill(typeof fill === 'string' ? fill.charCodeAt(0) : fill);
      }
      return buf;
    },
    allocUnsafe: (size: number) => new Uint8Array(size),
    isBuffer: (obj: any) => obj instanceof Uint8Array,
    concat: (list: Uint8Array[], totalLength?: number) => {
      const length = totalLength || list.reduce((sum, buf) => sum + buf.length, 0);
      const result = new Uint8Array(length);
      let offset = 0;
      for (const buf of list) {
        result.set(buf, offset);
        offset += buf.length;
      }
      return result;
    },
    compare: (a: Uint8Array, b: Uint8Array) => {
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] < b[i]) return -1;
        if (a[i] > b[i]) return 1;
      }
      return a.length - b.length;
    }
  };
}

// Polyfill for 'require' function (basic implementation)
if (typeof (globalThis as any).require === 'undefined') {
  (globalThis as any).require = (module: string) => {
    if (module === 'buffer') {
      return { Buffer: (globalThis as any).Buffer };
    }
    if (module === 'util') {
      return {
        inherits: (ctor: any, superCtor: any) => {
          ctor.super_ = superCtor;
          ctor.prototype = Object.create(superCtor.prototype, {
            constructor: { value: ctor, enumerable: false, writable: true, configurable: true }
          });
        },
        format: (...args: any[]) => args.join(' '),
        inspect: (obj: any) => JSON.stringify(obj)
      };
    }
    if (module === 'assert') {
      return {
        ok: (value: any, message?: string) => {
          if (!value) throw new Error(message || 'Assertion failed');
        },
        equal: (actual: any, expected: any, message?: string) => {
          if (actual !== expected) throw new Error(message || `${actual} !== ${expected}`);
        },
        AssertionError: class AssertionError extends Error {
          constructor(message?: string) {
            super(message);
            this.name = 'AssertionError';
          }
        }
      };
    }
    throw new Error(`Module '${module}' not found`);
  };
}

// Fix for MutationObserver DOM issues
const originalMutationObserver = (globalThis as any).MutationObserver;
if (originalMutationObserver) {
  (globalThis as any).MutationObserver = class extends originalMutationObserver {
    observe(target: Node, options?: MutationObserverInit) {
      try {
        if (target && target.nodeType !== undefined && typeof target.nodeType === 'number') {
          return super.observe(target, options);
        }
        console.warn('MutationObserver.observe called with invalid target:', target);
      } catch (error) {
        console.warn('MutationObserver.observe error:', error);
      }
    }
  };
}

// Fix for DOM manipulation issues
const originalSetAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function(name: string, value: string) {
  try {
    if (this && typeof this.setAttribute === 'function') {
      return originalSetAttribute.call(this, name, value);
    }
  } catch (error) {
    console.warn('setAttribute error:', error, 'element:', this, 'name:', name, 'value:', value);
  }
};

// Ensure DOM is ready before initializing
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('✅ DOM loaded, polyfills ready');
    });
  } else {
    console.log('✅ DOM already loaded, polyfills ready');
  }
}

console.log('✅ Node.js polyfills loaded successfully for Solana integration');
