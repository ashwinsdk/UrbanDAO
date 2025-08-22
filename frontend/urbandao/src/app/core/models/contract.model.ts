export interface ContractAddresses {
  network: string;
  chainId: string;
  contracts: {
    MetaForwarder: string;
    UrbanToken: string;
    TimelockController: string;
    UrbanGovernor: string;
    TaxReceipt: string;
    TaxModule: string;
    ProjectRegistry: string;
    GrievanceHub: string;
    UrbanCore: string;
    [key: string]: string;
  };
  metadata: {
    urbanToken: {
      imageURI: string;
      description: string;
    };
    taxReceipt: {
      defaultImageCID: string;
      baseTokenURI: string;
    };
  };
  config: {
    treasury: string;
    ownerGovt: string;
  };
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  blockExplorer: string;
}
