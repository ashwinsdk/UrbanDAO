export const environment = {
  production: true,
  solana: {
    cluster: 'mainnet-beta',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    programId: 'HLnt2dR9sUSYsogSPp7BA3ca4E6JfqgT8YLA77uTwNVt',
    commitment: 'confirmed' as const
  },
  api: {
    baseUrl: 'https://api.urbandao.org/api' // Placeholder for production API
  }
};
