// Load Buffer polyfill before any imports
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
    alloc: (size: number) => new Uint8Array(size),
    allocUnsafe: (size: number) => new Uint8Array(size),
    isBuffer: (obj: any) => obj instanceof Uint8Array,
    concat: (buffers: Uint8Array[]) => {
      const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
      }
      return result;
    },
    compare: (a: Uint8Array, b: Uint8Array) => {
      if (a.length !== b.length) return a.length - b.length;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return 0;
    }
  };
}

console.log('🚀🚀🚀 ANGULAR BOOTSTRAP STARTING - VERSION 2.0 🚀🚀🚀');
console.log('🔍 Systematic Angular import testing - CACHE REFRESH');
console.log('⚡ TIMESTAMP:', new Date().toISOString());

// Import Angular modules at top level (required by TypeScript)
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

console.log('✅ All Angular imports loaded successfully');
console.log('🚀 Attempting Angular bootstrap...');

bootstrapApplication(App, appConfig)
  .then(() => {
    console.log('✅ 🎉 Angular Bootstrap SUCCESS! App is now running!');
    console.log('✅ App component should be rendering in <app-root>');
  })
  .catch((err) => {
    console.error('❌ Angular Bootstrap FAILED:', err);
    console.error('❌ Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      cause: err.cause
    });
    
    // Provide helpful debugging info
    console.log('🔍 Debugging info:');
    console.log('- App component:', App);
    console.log('- App config:', appConfig);
    console.log('- DOM app-root element:', document.querySelector('app-root'));
  });
