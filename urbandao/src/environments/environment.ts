// Get private key from environment variable or use a placeholder for development
const TX_PAYER_PRIVATE_KEY = '6fdf99576bab4b8bd5073d888b5d403f329e652b3fc398a7dee49f1a192f0ef7';

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
    MetaForwarder: '0x91604F4F941F87d09cDC2C4b8BdA138Ea59002ab',
    UrbanToken: '0x54eBDEe59cF92D01729B59b70Bd35e6Dd077fD50',
    TimelockController: '0x18AF4168428D8b0cABD2AC4f1Dc72F74bAf40a2c',
    UrbanGovernor: '0x8BbaAbA578A107eC0240A98a3f6Fe3fe31746D2D',
    TaxReceipt: '0x078d160aF5380F4F37C25F547048dBFe7ABfd3f7',
    TaxModule: '0x47F09Cc7887293f851ab7f63693636ea2d84B3f1',
    ProjectRegistry: '0x08c083B002FDC6431Ff98E103a930b178c37ba7C',
    GrievanceHub: '0xc5a012651635C92a6CCD7f0388c49DcB796409A1',
    UrbanCore: '0x2C080380959400E023d340A9df6a2D819f51b938'
  },
  rolesMapping: {
    OWNER_ROLE: '0xE1d7C37f7fa7e189e0191c02379fE97BcB1c5984',
    ADMIN_GOVT_ROLE: '0xE1d7C37f7fa7e189e0191c02379fE97BcB1c5984',
    ADMIN_HEAD_ROLE: '0x224C1f97FF0570E3447D2A18E46ba5244ef19a6c',
    PROJECT_MANAGER_ROLE: '0x15900204E45560D7efb2df13e859824746da0A82',
    TAX_COLLECTOR_ROLE: '0x99da9Ab65660a4cbcd7B56b3055cB9794fCd7B9a',
    VALIDATOR_ROLE: '0x29b0AeFf310BC99ce4009b6599Ac45471354CbA4',
    TX_PAYER_ROLE: '0xA2b8748E6aD8efa24C7Eda95517DB76C0dFc68F1'
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
