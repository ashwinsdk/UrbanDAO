export const environment = {
  production: false,
  solana: {
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
    commitment: 'confirmed' as const
  },
  api: {
    baseUrl: 'http://localhost:3000'
  }
};
