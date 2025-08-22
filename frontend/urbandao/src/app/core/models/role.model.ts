export enum UserRole {
  OWNER_ROLE = 'OWNER_ROLE',
  ADMIN_GOVT_ROLE = 'ADMIN_GOVT_ROLE',
  ADMIN_HEAD_ROLE = 'ADMIN_HEAD_ROLE',
  PROJECT_MANAGER_ROLE = 'PROJECT_MANAGER_ROLE',
  TAX_COLLECTOR_ROLE = 'TAX_COLLECTOR_ROLE',
  VALIDATOR_ROLE = 'VALIDATOR_ROLE',
  CITIZEN_ROLE = 'CITIZEN_ROLE',
  TX_PAYER_ROLE = 'TX_PAYER_ROLE',
  NONE = 'NONE'
}

export interface RoleInfo {
  address: string;
  description: string;
  status?: string;
  txHash?: string;
}

export interface RoleData {
  network: string;
  chainId: string;
  roles: {
    [key in UserRole]?: RoleInfo;
  };
  contractAddress: string;
  lastVerified: string;
}
