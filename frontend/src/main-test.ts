// Minimal test file to check if TypeScript/JavaScript execution works at all
console.log('🧪 MAIN-TEST.TS IS EXECUTING!');
console.log('🧪 Basic JavaScript execution confirmed');

// Test basic DOM manipulation
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧪 DOM loaded, attempting to modify app-root');
  
  const appRoot = document.querySelector('app-root');
  if (appRoot) {
    appRoot.innerHTML = `
      <div style="padding: 40px; background: linear-gradient(45deg, #ff6b6b, #4ecdc4); color: white; font-family: Arial, sans-serif; min-height: 100vh;">
        <h1 style="font-size: 3rem; margin-bottom: 20px;">🧪 BASIC JAVASCRIPT TEST SUCCESSFUL!</h1>
        <p style="font-size: 1.5rem;">This proves that:</p>
        <ul style="font-size: 1.2rem; line-height: 1.8;">
          <li>✅ main.ts file is executing</li>
          <li>✅ TypeScript compilation is working</li>
          <li>✅ Script loading is working</li>
          <li>✅ DOM manipulation is working</li>
          <li>✅ Basic JavaScript runtime is functional</li>
        </ul>
        <p style="margin-top: 30px; font-size: 1.3rem; background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px;">
          <strong>Next Step:</strong> If you can see this, the issue is specifically with Angular imports or bootstrap, not with basic script execution.
        </p>
      </div>
    `;
    console.log('🧪 Successfully modified app-root content');
  } else {
    console.error('🧪 ERROR: app-root element not found in DOM');
  }
});

// Test if we can access global objects
console.log('🧪 Window object available:', typeof window !== 'undefined');
console.log('🧪 Document object available:', typeof document !== 'undefined');
console.log('🧪 Buffer polyfill available:', typeof (globalThis as any).Buffer !== 'undefined');
