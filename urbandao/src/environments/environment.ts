// Get private key from environment variable or use a placeholder for development
const TX_PAYER_PRIVATE_KEY = 'e2e7813cd14e8e7765b848d4eb48bf8257e1367ba4d896a867b9e1224a0b07fe';

export const environment = {
  production: false,
  network: {
    chainId: 11155111,
    name: 'Sepolia',
    currency: 'SepoliaETH',
    rpcUrl: 'https://sepolia.infura.io/v3/fce8183a885b4d70a55129db4665bf8d',
    blockExplorer: 'https://sepolia.etherscan.io'
  },
  contracts: {
    MetaForwarder: '0x3C099955E96d2bf9709b88d3051a9d3B323a508F',
    UrbanToken: '0x7d7E3659FCBaC7718C8E1Eb3CC6CD2ef98dB0bdD',
    TimelockController: '0x8C8f27e9C1eaB946a76069D7CaB366DB8aF51512',
    UrbanGovernor: '0xcB688CBDA710B887754bCb50213a3D219C05EEeD',
    TaxReceipt: '0xB94996264EBf47725d6c6C4f9FdcDA42dAA67628',
    TaxModule: '0x96AAB8Bad87725C7FD032f29d7D4240a306b1Dc1',
    ProjectRegistry: '0x67dea35EB0Dd7AC01B50FD01D11518219F9B6B08',
    GrievanceHub: '0x6fc4C136F5FD945E441C616D4886D518B11Ba1cC',
    UrbanCore: '0x0b67690EDDb4e2bc094b996183bAcD77F18B2D55'
  },
  rolesMapping: {
    OWNER_ROLE: '0xE1d7C37f7fa7e189e0191c02379fE97BcB1c5984',
    ADMIN_GOVT_ROLE: '0xE1d7C37f7fa7e189e0191c02379fE97BcB1c5984',
    ADMIN_HEAD_ROLE: '0x224C1f97FF0570E3447D2A18E46ba5244ef19a6c',
    PROJECT_MANAGER_ROLE: '0x15900204E45560D7efb2df13e859824746da0A82',
    TAX_COLLECTOR_ROLE: '0x99da9Ab65660a4cbcd7B56b3055cB9794fCd7B9a',
    VALIDATOR_ROLE: '0x29b0AeFf310BC99ce4009b6599Ac45471354CbA4',
    CITIZEN_ROLE: '0x76798487eD5C8E0bC849C2DB53eD880E4a9fcCdE',
    TX_PAYER_ROLE: '0xe0b1Ee4660E296BAe4054F67C5D46493ff455061'
  },
  // Private key for the TX_PAYER account (only for development)
  // This should be replaced with a real private key for testing
  // In production, this should be handled by a secure backend service
  txPayerPrivateKey: TX_PAYER_PRIVATE_KEY,
  // Optional IPFS configuration for development
  // You can set a custom gateway list and add Authorization headers if needed.
  // Example for Pinata JWT: set authJWT to your JWT string.
  // Example for Basic auth (Infura IPFS): set basicAuth to base64("<projectId>:<projectSecret>").
  ipfs: {
    gateways: [
      'https://gateway.pinata.cloud/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
      'https://ipfs.io/ipfs'
    ],
    authJWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJkYTJhNTE3Yy05MTZmLTQ1OTktYjU3MC00YmRiYmU4NzUzNjEiLCJlbWFpbCI6ImFzaHdpbjIwMDVzQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiNTZlNzQ0MjM1NTUwNjk2YmQ2ZiIsInNjb3BlZEtleVNlY3JldCI6IjVkYTE0M2YwMzNhNDJjYzA2OTE1ZDY1YzVmOGRiOWI3MGEwODQzZmIwNTc5YWVkMzQ0NzA1OWQxM2YwYWYwY2QiLCJleHAiOjE3ODcwNjk1MDN9.Ueugd1W9LxYUPvLGI2tJUyLPWwYihfVXOvCOsob9Fx0',
    basicAuth: ''
  }
};
