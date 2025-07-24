// Global type declarations for UrbanDAO project

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isConnected: boolean;
      publicKey: { toString: () => string } | null;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: (args: any) => void) => void;
      off: (event: string, callback: (args: any) => void) => void;
      // Additional properties for compatibility
      signTransaction?: (transaction: any) => Promise<any>;
      signAllTransactions?: (transactions: any[]) => Promise<any[]>;
    };
  }
}

export {};
