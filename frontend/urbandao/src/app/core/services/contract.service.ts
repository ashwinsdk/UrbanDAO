import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { Web3Service } from './web3.service';
import { environment } from '../../../environments/environment';
import { BehaviorSubject } from 'rxjs';

// Import ABIs for contracts
import urbanCoreABI from '../abis/UrbanCore.json';
import urbanTokenABI from '../abis/UrbanToken.json';
import grievanceHubABI from '../abis/GrievanceHub.json';
import projectRegistryABI from '../abis/ProjectRegistry.json';
import taxModuleABI from '../abis/TaxModule.json';
import metaForwarderABI from '../abis/MetaForwarder.json';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private urbanCoreContract: ethers.Contract | null = null;
  private urbanTokenContract: ethers.Contract | null = null;
  private grievanceHubContract: ethers.Contract | null = null;
  private projectRegistryContract: ethers.Contract | null = null;
  private taxModuleContract: ethers.Contract | null = null;
  private metaForwarderContract: ethers.Contract | null = null;
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private web3Service: Web3Service) {
    this.web3Service.connected$.subscribe(connected => {
      if (connected) {
        this.initContracts();
      } else {
        this.resetContracts();
      }
    });
  }

  private async initContracts(): Promise<void> {
    try {
      this.loadingSubject.next(true);
      
      const provider = this.web3Service.getProvider();
      const signer = this.web3Service.getSigner();
      
      if (!provider || !signer) {
        throw new Error('Provider or signer not available');
      }

      // Initialize contracts with ABI and address
      this.urbanCoreContract = new ethers.Contract(
        environment.contracts.UrbanCore,
        urbanCoreABI,
        signer
      );
      
      this.urbanTokenContract = new ethers.Contract(
        environment.contracts.UrbanToken,
        urbanTokenABI,
        signer
      );
      
      this.grievanceHubContract = new ethers.Contract(
        environment.contracts.GrievanceHub,
        grievanceHubABI,
        signer
      );
      
      this.projectRegistryContract = new ethers.Contract(
        environment.contracts.ProjectRegistry,
        projectRegistryABI,
        signer
      );
      
      this.taxModuleContract = new ethers.Contract(
        environment.contracts.TaxModule,
        taxModuleABI,
        signer
      );
      
      this.metaForwarderContract = new ethers.Contract(
        environment.contracts.MetaForwarder,
        metaForwarderABI,
        signer
      );
    } catch (error) {
      console.error('Error initializing contracts:', error);
      this.resetContracts();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private resetContracts(): void {
    this.urbanCoreContract = null;
    this.urbanTokenContract = null;
    this.grievanceHubContract = null;
    this.projectRegistryContract = null;
    this.taxModuleContract = null;
    this.metaForwarderContract = null;
  }

  // Urban Core contract functions
  public async hasRole(role: string, address: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      return await this.urbanCoreContract['hasRole'](roleBytes, address);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  public async getUserRole(address: string): Promise<string | null> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check each role starting from highest privilege
      const roles = [
        'OWNER_ROLE',
        'ADMIN_GOVT_ROLE',
        'ADMIN_HEAD_ROLE',
        'PROJECT_MANAGER_ROLE',
        'TAX_COLLECTOR_ROLE',
        'VALIDATOR_ROLE',
        'CITIZEN_ROLE',
        'TX_PAYER_ROLE'
      ];
      
      for (const role of roles) {
        const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
        const hasRole = await this.urbanCoreContract['hasRole'](roleBytes, address);
        if (hasRole) return role;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  // Admin Head module methods
  // Get the area ID for an admin
  public async getAdminAreaId(adminAddress: string | null): Promise<string | null> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation - in a real scenario would query the contract
      return "1"; // Return area ID 1 for testing as string
    } catch (error) {
      console.error('Error getting admin area ID:', error);
      return null;
    }
  }
  
  // Get pending role requests for an area
  public async getPendingRoleRequests(areaId: string): Promise<any[]> {
    try {
      const allRequests = await this.getRoleRequests('CITIZEN');
      // Filter to only show pending requests for this area
      return allRequests.filter(request => request.areaId === areaId && request.status === 'pending');
    } catch (error) {
      console.error('Error getting pending role requests:', error);
      return [];
    }
  }
  
  // Get role holders by area
  public async getRoleHoldersByArea(areaId: string, role: string): Promise<any[]> {
    try {
      const allHolders = await this.getRoleHolders(role);
      // In a real implementation, would filter by area
      // For now return all holders
      return allHolders;
    } catch (error) {
      console.error('Error getting role holders by area:', error);
      return [];
    }
  }
  
  // Check if user has any other role
  public async hasAnyOtherRole(address: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      // In a real scenario would check all roles for this address
      return Math.random() > 0.5; // Randomly return true or false for testing
    } catch (error) {
      console.error('Error checking for other roles:', error);
      return false;
    }
  }
  
  // Alias for uploadToIpfs
  public async uploadToIPFS(data: any): Promise<string> {
    return this.uploadToIpfs(data);
  }
  
  // Method to assign a role to a user
  public async assignRole(address: string, role: string, areaId: string, metadataHash?: string): Promise<boolean> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      console.log(`Assigning role ${role} to ${address} in area ${areaId}`);
      return true;
    } catch (error) {
      console.error('Error assigning role:', error);
      return false;
    }
  }
  
  // Get projects by area
  public async getProjectsByArea(areaId: string): Promise<number[]> {
    const numericAreaId = parseInt(areaId, 10);
    return this.getProjectsInArea(numericAreaId);
  }
  
  // Helper methods for currency conversion
  public weiToEth(weiValue: string): string {
    return ethers.formatEther(weiValue);
  }
  
  public ethToWei(ethValue: string | number): string {
    return ethers.parseEther(ethValue.toString()).toString();
  }
  
  // Method to reject a grievance
  public async rejectGrievance(grievanceId: string, feedback: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation
      console.log(`Rejecting grievance ${grievanceId} with feedback: ${feedback}`);
      return 'mock-transaction-hash';
    } catch (error) {
      console.error('Error rejecting grievance:', error);
      return null;
    }
  }
  
  // Get grievances for an area
  public async getGrievancesByArea(areaId: string): Promise<string[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation - return some IDs
      return ['grievance-1', 'grievance-2', 'grievance-3', 'grievance-4', 'grievance-5'];
    } catch (error) {
      console.error('Error getting grievances by area:', error);
      return [];
    }
  }
  
  // Get grievances by status and area
  public async getGrievancesByStatusAndArea(status: string, areaId: string): Promise<string[]> {
    try {
      const allGrievances = await this.getGrievancesByArea(areaId);
      // In a real implementation, filter by status
      // For now return all grievances for any status
      return allGrievances;
    } catch (error) {
      console.error(`Error getting ${status} grievances for area ${areaId}:`, error);
      return [];
    }
  }
  
  // Get citizens by area
  public async getCitizensByArea(areaId: string): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      return [
        { address: '0x1234...', name: 'Citizen 1', registrationDate: new Date() },
        { address: '0x5678...', name: 'Citizen 2', registrationDate: new Date() },
        { address: '0x9ABC...', name: 'Citizen 3', registrationDate: new Date() }
      ];
    } catch (error) {
      console.error('Error getting citizens by area:', error);
      return [];
    }
  }
  
  // AdminGovt methods
  /**
   * Admin Government Methods
   */

  public async getTotalCitizenCount(): Promise<number> {
    try {
      return 1250; // Mock implementation
    } catch (error) {
      console.error('Error getting total citizen count:', error);
      throw new Error('Failed to get total citizen count');
    }
  }

  public async getTotalProjectsCount(): Promise<number> {
    try {
      return 42; // Mock implementation
    } catch (error) {
      console.error('Error getting total projects count:', error);
      throw new Error('Failed to get total projects count');
    }
  }

  public async getTotalGrievancesCount(): Promise<number> {
    try {
      return 326; // Mock implementation
    } catch (error) {
      console.error('Error getting total grievances count:', error);
      throw new Error('Failed to get total grievances count');
    }
  }

  public async getTotalTaxCollected(): Promise<string> {
    try {
      return '15000000000000000000'; // Mock implementation (15 ETH in wei)
    } catch (error) {
      console.error('Error getting total tax collected:', error);
      throw new Error('Failed to get total tax collected');
    }
  }

  public async getRecentSystemEvents(): Promise<any[]> {
    try {
      return [
        { id: '1', type: 'NewArea', title: 'New Area Created', description: 'Area #12 was created', timestamp: Date.now() - 3600000 },
        { id: '2', type: 'NewRole', title: 'Role Assigned', description: 'New tax collector assigned to Area #5', timestamp: Date.now() - 7200000 },
        { id: '3', type: 'TaxCollection', title: 'Tax Milestone', description: '10 ETH total tax collected', timestamp: Date.now() - 86400000 }
      ]; // Mock implementation
    } catch (error) {
      console.error('Error getting recent system events:', error);
      throw new Error('Failed to get recent system events');
    }
  }


  public async getAreaCitizenCount(areaId: string): Promise<number> {
    try {
      const citizens = await this.getCitizensByArea(areaId);
      return citizens.length;
    } catch (error) {
      console.error('Error getting area citizen count:', error);
      return 0;
    }
  }
  
  // Create a new area
  public async createArea(areaName: string): Promise<string | null> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Mock implementation
      console.log(`Creating area ${areaName}`);
      return 'mock-transaction-hash';
    } catch (error) {
      console.error('Error creating area:', error);
      return null;
    }
  }
  
  // This is just a wrapper around the existing approveRoleRequest implementation
  // that ignores the second parameter for backward compatibility
  public async approveRoleRequestWithArea(requestId: string, areaId: string): Promise<boolean> {
    try {
      const result = await this.approveRoleRequest(requestId);
      return !!result;
    } catch (error) {
      console.error('Error approving role request:', error);
      return false;
    }
  }
  
  // Get a grievance (alias for getGrievanceById)
  public async getGrievance(grievanceId: string): Promise<any> {
    return this.getGrievanceById(grievanceId);
  }
  
  // Escalate grievance to project
  public async escalateGrievanceToProject(
    grievanceId: string,
    projectName: string,
    projectDescription: string,
    budget: string,
    initialFunding: string,
    projectManager: string
  ): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation
      console.log(`Escalating grievance ${grievanceId} to project: ${projectName}`);
      return 'mock-transaction-hash';
    } catch (error) {
      console.error('Error escalating grievance to project:', error);
      return null;
    }
  }

  // Grievance Hub contract functions
  public async getGrievancesForCitizen(address: string): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      const grievanceCount = await this.grievanceHubContract['getGrievanceCountForCitizen'](address);
      const grievances = [];
      
      for (let i = 0; i < grievanceCount; i++) {
        const id = await this.grievanceHubContract['getCitizenGrievanceIdAtIndex'](address, i);
        const grievance = await this.grievanceHubContract['getGrievance'](id);
        grievances.push({
          id,
          title: grievance.title,
          description: grievance.description,
          status: grievance.status,
          citizen: grievance.citizen,
          validator: grievance.validator,
          createdAt: new Date(Number(grievance.createdAt) * 1000),
          updatedAt: new Date(Number(grievance.updatedAt) * 1000)
        });
      }
      
      return grievances;
    } catch (error) {
      console.error('Error getting grievances:', error);
      return [];
    }
  }

  public async fileGrievance(title: string, description: string, documents: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        return await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'fileGrievance',
          [title, description, documents]
        );
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['fileGrievance'](title, description, documents);
        const receipt = await tx.wait();
        return receipt.hash;
      }
    } catch (error) {
      console.error('Error filing grievance:', error);
      return null;
    }
  }

  // Project Registry contract functions
  public async getProjectsInArea(areaId: number): Promise<any[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const projectCount = await this.projectRegistryContract['getProjectCountInArea'](areaId);
      const projects = [];
      
      for (let i = 0; i < projectCount; i++) {
        const id = await this.projectRegistryContract['getProjectIdInAreaAtIndex'](areaId, i);
        const project = await this.projectRegistryContract['getProject'](id);
        projects.push({
          id,
          title: project.title,
          description: project.description,
          budget: ethers.formatEther(project.budget),
          status: project.status,
          manager: project.manager,
          createdAt: new Date(Number(project.createdAt) * 1000)
        });
      }
      
      return projects;
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  // Tax Module contract functions
  public async getTaxAssessmentsForCitizen(address: string): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const assessmentCount = await this.taxModuleContract['getTaxAssessmentCountForCitizen'](address);
      const assessments = [];
      
      for (let i = 0; i < assessmentCount; i++) {
        const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](address, i);
        const assessment = await this.taxModuleContract['getTaxAssessment'](id);
        assessments.push({
          id,
          amount: ethers.formatEther(assessment.amount),
          year: assessment.year,
          paid: assessment.paid,
          dueDate: new Date(Number(assessment.dueDate) * 1000),
          citizen: assessment.citizen,
          receiptId: assessment.receiptId
        });
      }
      
      return assessments;
    } catch (error) {
      console.error('Error getting tax assessments:', error);
      return [];
    }
  }

  // Meta transaction helper functions
  private async shouldUseMetaTransaction(): Promise<boolean> {
    // Check if TX_PAYER is available
    try {
      const txPayerAddress = environment.rolesMapping.TX_PAYER_ROLE;
      if (!txPayerAddress) return false;
      
      // Check if tx payer has enough balance
      const provider = this.web3Service.getProvider();
      if (!provider) return false;
      
      const balance = await provider.getBalance(txPayerAddress);
      return balance > ethers.parseEther('0.01'); // Minimum balance required
    } catch {
      return false;
    }
  }

  private async sendMetaTransaction(
    targetContract: string,
    functionName: string,
    params: any[]
  ): Promise<string | null> {
    try {
      if (!this.metaForwarderContract) await this.initContracts();
      if (!this.metaForwarderContract) throw new Error('Meta Forwarder contract not initialized');
      
      const signer = this.web3Service.getSigner();
      if (!signer) throw new Error('Signer not available');
      
      const userAddress = await signer.getAddress();
      
      // Encode function data
      const iface = new ethers.Interface([
        `function ${functionName}(${params.map(() => 'string').join(',')})`
      ]);
      
      const data = iface.encodeFunctionData(functionName, params);
      
      // Get nonce for meta transaction
      const nonce = await this.metaForwarderContract['getNonce'](userAddress);
      
      // Create meta transaction data
      const metaTxData = {
        from: userAddress,
        to: targetContract,
        value: 0,
        gas: 500000,
        nonce,
        data
      };
      
      // Sign meta transaction
      const domain = {
        name: 'MetaForwarder',
        version: '1',
        chainId: this.web3Service.getCurrentChainId() || environment.network.chainId,
        verifyingContract: environment.contracts.MetaForwarder
      };
      
      const types = {
        MetaTransaction: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'data', type: 'bytes' }
        ]
      };
      
      const signature = await signer.signTypedData(domain, types, metaTxData);
      
      // Send meta transaction
      const tx = await this.metaForwarderContract['executeMetaTransaction'](
        metaTxData.from,
        metaTxData.to,
        metaTxData.value,
        metaTxData.gas,
        metaTxData.data,
        signature
      );
      
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      console.error('Error sending meta transaction:', error);
      return null;
    }
  }

  // Getter methods for contracts
  public getUrbanCoreContract(): ethers.Contract | null {
    return this.urbanCoreContract;
  }

  public getUrbanTokenContract(): ethers.Contract | null {
    return this.urbanTokenContract;
  }

  public getGrievanceHubContract(): ethers.Contract | null {
    return this.grievanceHubContract;
  }

  public getProjectRegistryContract(): ethers.Contract | null {
    return this.projectRegistryContract;
  }

  public getTaxModuleContract(): ethers.Contract | null {
    return this.taxModuleContract;
  }

  public getMetaForwarderContract(): ethers.Contract | null {
    return this.metaForwarderContract;
  }

  // Area management functions
  public async getAllAreaIds(): Promise<string[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const areaCount = await this.urbanCoreContract['getAreaCount']();
      
      const areaIds: string[] = [];
      for (let i = 0; i < areaCount; i++) {
        const areaId = await this.urbanCoreContract['getAreaIdAtIndex'](i);
        areaIds.push(areaId.toString());
      }
      
      return areaIds;
    } catch (error) {
      console.error('Error getting area IDs:', error);
      return [];
    }
  }

  public async getAreaDetails(areaId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const area = await this.urbanCoreContract['getArea'](areaId);
      return {
        id: areaId,
        name: area.name,
        adminHead: area.adminHead,
        citizenCount: area.citizenCount.toString(),
        metadata: area.metadata
      };
    } catch (error) {
      console.error(`Error getting area details for area ${areaId}:`, error);
      return {};
    }
  }

  public async assignAreaAdminHead(areaId: string, adminHeadAddress: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['assignAreaAdminHead'](areaId, adminHeadAddress);
      return tx;
    } catch (error) {
      console.error(`Error assigning admin head to area ${areaId}:`, error);
      throw error;
    }
  }

  // Role management functions
  public async getRoleHolders(role: string): Promise<string[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      const count = await this.urbanCoreContract['getRoleMemberCount'](roleBytes);
      
      const addresses: string[] = [];
      for (let i = 0; i < count; i++) {
        const address = await this.urbanCoreContract['getRoleMember'](roleBytes, i);
        addresses.push(address);
      }
      
      return addresses;
    } catch (error) {
      console.error(`Error getting role holders for ${role}:`, error);
      return [];
    }
  }

  public async getRoleRequests(role: string): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      const requestCount = await this.urbanCoreContract['getRoleRequestCount'](roleBytes);
      
      const requests = [];
      for (let i = 0; i < requestCount; i++) {
        const requestId = await this.urbanCoreContract['getRoleRequestIdAtIndex'](roleBytes, i);
        const request = await this.urbanCoreContract['getRoleRequest'](requestId);
        
        requests.push({
          id: requestId.toString(),
          requester: request.requester,
          role: request.role,
          status: this.resolveRoleRequestStatus(request.status),
          timestamp: request.timestamp.toString(),
          metadataUri: request.metadataUri
        });
      }
      
      return requests;
    } catch (error) {
      console.error(`Error getting role requests for ${role}:`, error);
      return [];
    }
  }

  private resolveRoleRequestStatus(status: number): string {
    const statusMap: {[key: number]: string} = {
      0: 'pending',
      1: 'approved',
      2: 'rejected'
    };
    return statusMap[status] || 'unknown';
  }

  public async approveRoleRequest(requestId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['approveRoleRequest'](requestId);
      return tx;
    } catch (error) {
      console.error(`Error approving role request ${requestId}:`, error);
      throw error;
    }
  }

  public async rejectRoleRequest(requestId: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const tx = await this.urbanCoreContract['rejectRoleRequest'](requestId);
      return tx;
    } catch (error) {
      console.error(`Error rejecting role request ${requestId}:`, error);
      throw error;
    }
  }

  public async grantRole(role: string, address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      const tx = await this.urbanCoreContract['grantRole'](roleBytes, address);
      return tx;
    } catch (error) {
      console.error(`Error granting role ${role} to ${address}:`, error);
      throw error;
    }
  }

  public async grantRoleWithMetadata(role: string, address: string, metadataUri: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      const tx = await this.urbanCoreContract['grantRoleWithMetadata'](roleBytes, address, metadataUri);
      return tx;
    } catch (error) {
      console.error(`Error granting role ${role} with metadata to ${address}:`, error);
      throw error;
    }
  }

  public async revokeRole(role: string, address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const roleBytes = ethers.keccak256(ethers.toUtf8Bytes(role));
      const tx = await this.urbanCoreContract['revokeRole'](roleBytes, address);
      return tx;
    } catch (error) {
      console.error(`Error revoking role ${role} from ${address}:`, error);
      throw error;
    }
  }

  // IPFS functions
  public async uploadToIpfs(data: any): Promise<string> {
    try {
      // Convert data to JSON string
      const jsonData = JSON.stringify(data);
      
      // In a real implementation, this would use an IPFS client
      // For now, we'll use a mock implementation that returns a fake CID
      console.log('Uploading data to IPFS:', jsonData);
      
      // Generate a pseudo-random CID for testing
      const mockCid = 'Qm' + Array.from({length: 44}, () => 
        '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]
      ).join('');
      
      return `ipfs://${mockCid}`;
    } catch (error) {
      console.error('Error uploading to IPFS:', error);
      throw error;
    }
  }

  public async getIpfsJson(ipfsUri: string): Promise<any> {
    try {
      // In a real implementation, this would fetch from IPFS
      // For now, return mock data based on the URI
      console.log('Fetching IPFS data from:', ipfsUri);
      
      // Generate some deterministic mock data based on the CID
      const cid = ipfsUri.replace('ipfs://', '');
      const mockData = {
        name: `User ${cid.substring(0, 6)}`,
        description: `Metadata for ${cid.substring(0, 10)}`,
        role: 'Admin Head',
        timestamp: Date.now() / 1000
      };
      
      return mockData;
    } catch (error) {
      console.error('Error getting IPFS JSON:', error);
      throw error;
    }
  }

  public async getAddressMetadata(address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      const metadataUri = await this.urbanCoreContract['getAddressMetadata'](address);
      
      if (!metadataUri || metadataUri === '') {
        return null;
      }
      
      return await this.getIpfsJson(metadataUri);
    } catch (error) {
      console.error(`Error getting metadata for address ${address}:`, error);
      return null;
    }
  }

  // Methods for validator module
  public async getPendingGrievances(limit?: number): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get all grievances with 'Pending' status
      const pendingGrievanceCount = await this.grievanceHubContract['getPendingGrievanceCount']();
      const maxCount = limit ? Math.min(limit, pendingGrievanceCount) : pendingGrievanceCount;
      const grievances = [];
      
      for (let i = 0; i < maxCount; i++) {
        const id = await this.grievanceHubContract['getPendingGrievanceAtIndex'](i);
        const grievance = await this.grievanceHubContract['getGrievance'](id);
        
        // Get citizen metadata if available
        let citizenName = '';
        try {
          const metadata = await this.getAddressMetadata(grievance.citizen);
          if (metadata && metadata.name) {
            citizenName = metadata.name;
          }
        } catch (error) {
          console.warn(`Could not get metadata for citizen ${grievance.citizen}`, error);
        }
        
        // Parse grievance data from contract
        const parsedGrievance = {
          id: id.toString(),
          title: grievance.title || '',
          description: grievance.description || '',
          location: grievance.location || '',
          type: this.resolveGrievanceType(grievance.grievanceType || 0),
          timestamp: grievance.timestamp ? Number(grievance.timestamp) : Date.now() / 1000,
          citizenAddress: grievance.citizen,
          citizenName,
          urgent: grievance.urgent || false,
          imageUrls: grievance.documents ? this.parseDocumentUrls(grievance.documents) : []
        };
        
        grievances.push(parsedGrievance);
      }
      
      return grievances;
    } catch (error) {
      console.error('Error getting pending grievances:', error);
      return [];
    }
  }
  
  public async getGrievanceById(grievanceId: string): Promise<any> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      const grievance = await this.grievanceHubContract['getGrievance'](grievanceId);
      
      // Get citizen metadata if available
      let citizenName = '';
      try {
        const metadata = await this.getAddressMetadata(grievance.citizen);
        if (metadata && metadata.name) {
          citizenName = metadata.name;
        }
      } catch (error) {
        console.warn(`Could not get metadata for citizen ${grievance.citizen}`, error);
      }
      
      // Parse grievance data from contract
      return {
        id: grievanceId,
        title: grievance.title || '',
        description: grievance.description || '',
        location: grievance.location || '',
        type: this.resolveGrievanceType(grievance.grievanceType || 0),
        timestamp: grievance.timestamp ? new Date(Number(grievance.timestamp) * 1000) : new Date(),
        citizenAddress: grievance.citizen,
        citizenName,
        validatorAddress: grievance.validator,
        status: this.resolveGrievanceStatus(grievance.status),
        urgent: grievance.urgent || false,
        imageUrls: grievance.documents ? this.parseDocumentUrls(grievance.documents) : [],
        comments: grievance.comments || '',
        resolutionDetails: grievance.resolutionDetails || '',
        resolutionTimestamp: grievance.resolutionTimestamp ? new Date(Number(grievance.resolutionTimestamp) * 1000) : null
      };
    } catch (error) {
      console.error(`Error getting grievance with ID ${grievanceId}:`, error);
      return null;
    }
  }
  
  public async processGrievance(
    grievanceId: string,
    isApproved: boolean,
    comments: string
  ): Promise<boolean> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const methodName = isApproved ? 'approveGrievance' : 'rejectGrievance';
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          methodName,
          [grievanceId, comments]
        );
        return !!hash;
      } else {
        // Direct transaction
        let tx;
        if (isApproved) {
          tx = await this.grievanceHubContract['approveGrievance'](grievanceId, comments);
        } else {
          tx = await this.grievanceHubContract['rejectGrievance'](grievanceId, comments);
        }
        await tx.wait();
        return true;
      }
    } catch (error) {
      console.error(`Error processing grievance ${grievanceId}:`, error);
      return false;
    }
  }
  
  public async getValidatorGrievanceStats(validatorAddress: string): Promise<any> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get validator stats from contract
      const pendingCount = await this.grievanceHubContract['getValidatorPendingCount'](validatorAddress);
      const approvedCount = await this.grievanceHubContract['getValidatorApprovedCount'](validatorAddress);
      const rejectedCount = await this.grievanceHubContract['getValidatorRejectedCount'](validatorAddress);
      
      return {
        pending: Number(pendingCount),
        approved: Number(approvedCount),
        rejected: Number(rejectedCount),
        total: Number(pendingCount) + Number(approvedCount) + Number(rejectedCount)
      };
    } catch (error) {
      console.error(`Error getting validator stats for ${validatorAddress}:`, error);
      return {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
      };
    }
  }
  
  public async getProcessedGrievancesByValidator(validatorAddress: string): Promise<any[]> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Get all processed grievances for this validator
      const processedCount = await this.grievanceHubContract['getValidatorProcessedCount'](validatorAddress);
      const grievances = [];
      
      for (let i = 0; i < processedCount; i++) {
        const id = await this.grievanceHubContract['getValidatorProcessedIdAtIndex'](validatorAddress, i);
        const grievance = await this.grievanceHubContract['getGrievance'](id);
        
        // Get citizen metadata if available
        let citizenName = '';
        try {
          const metadata = await this.getAddressMetadata(grievance.citizen);
          if (metadata && metadata.name) {
            citizenName = metadata.name;
          }
        } catch (error) {
          console.warn(`Could not get metadata for citizen ${grievance.citizen}`, error);
        }
        
        // Parse grievance data from contract
        const parsedGrievance = {
          id: id.toString(),
          title: grievance.title || '',
          description: grievance.description || '',
          status: this.resolveGrievanceStatus(grievance.status),
          timestamp: grievance.timestamp ? new Date(Number(grievance.timestamp) * 1000) : new Date(),
          resolutionTimestamp: grievance.resolutionTimestamp ? new Date(Number(grievance.resolutionTimestamp) * 1000) : new Date(),
          citizenAddress: grievance.citizen,
          citizenName,
          urgent: grievance.urgent || false,
          comments: grievance.comments || '',
          type: this.resolveGrievanceType(grievance.grievanceType || 0)
        };
        
        grievances.push(parsedGrievance);
      }
      
      return grievances;
    } catch (error) {
      console.error(`Error getting processed grievances for validator ${validatorAddress}:`, error);
      return [];
    }
  }
  
  // Helper method to resolve grievance status
  private resolveGrievanceStatus(status: number): string {
    const statusMap: {[key: number]: string} = {
      0: 'pending',
      1: 'approved',
      2: 'rejected',
      3: 'resolved'
    };
    return statusMap[status] || 'unknown';
  }

  // Helper method to resolve grievance type
  private resolveGrievanceType(typeId: number): string {
    const types = [
      'Other',
      'Infrastructure',
      'Sanitation',
      'Water Supply',
      'Electricity',
      'Public Safety',
      'Noise Pollution',
      'Road Maintenance',
      'Waste Management'
    ];
    return types[typeId] || 'Other';
  }

  // Helper method to parse document URLs
  private parseDocumentUrls(documents: string): string[] {
    try {
      if (!documents) return [];
      // Document string may be a JSON array or a comma-separated list
      if (documents.startsWith('[')) {
        return JSON.parse(documents);
      } else {
        return documents.split(',').map(url => url.trim()).filter(url => url.length > 0);
      }
    } catch (error) {
      console.error('Error parsing document URLs:', error);
      return [];
    }
  }
  
  // Add comment to a grievance
  public async addGrievanceComment(grievanceId: string, comment: string): Promise<string | null> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        return await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'addComment',
          [grievanceId, comment]
        );
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['addComment'](grievanceId, comment);
        const receipt = await tx.wait();
        return receipt.hash;
      }
    } catch (error) {
      console.error('Error adding comment to grievance:', error);
      return null;
    }
  }
  
  // Get recent tax payments for admin dashboard
  public async getRecentTaxPayments(limit: number = 5): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // In a real implementation, this would fetch recent payments from events or state
      // For now, return mock data
      const mockPayments = [];
      
      for (let i = 0; i < limit; i++) {
        mockPayments.push({
          id: `tx-${Date.now() - i * 86400000}`,
          citizen: `0x${Math.random().toString(16).substring(2, 12)}...`,
          amount: (Math.random() * 5 + 0.1).toFixed(4),
          timestamp: new Date(Date.now() - i * 86400000),
          assessmentId: `tax-${Math.floor(Math.random() * 1000)}`,
          receiptId: `receipt-${Math.floor(Math.random() * 10000)}`
        });
      }
      
      return mockPayments;
    } catch (error) {
      console.error('Error getting recent tax payments:', error);
      return [];
    }
  }

  // Project Manager module methods
  public async getProject(projectId: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const project = await this.projectRegistryContract['getProject'](projectId);
      
      return {
        id: projectId,
        areaId: project.areaId,
        titleHash: project.titleHash,
        descriptionHash: project.descriptionHash,
        manager: project.manager,
        fundingGoal: project.fundingGoal,
        escrowed: project.escrowed,
        released: project.released,
        status: project.status,
        milestoneCount: project.milestoneCount,
        currentMilestone: project.currentMilestone,
        citizenUpvotes: project.citizenUpvotes,
        createdAt: project.createdAt
      };
    } catch (error) {
      console.error(`Error getting project ${projectId}:`, error);
      throw error;
    }
  }

  public async getIPFSContent(ipfsHash: string): Promise<string> {
    try {
      // In a real implementation, this would fetch from IPFS gateway
      // For now, return mock data based on the hash
      console.log('Fetching IPFS content for hash:', ipfsHash);
      
      // If it's a real IPFS hash/URI, strip the prefix
      const cleanHash = ipfsHash.replace('ipfs://', '');
      
      // For testing, return a deterministic string based on the hash
      if (cleanHash.includes('title')) {
        return `Project ${cleanHash.substring(0, 6)}`;
      } else if (cleanHash.includes('desc')) {
        return `This is a description for project ${cleanHash.substring(0, 6)}. It contains details about the project goals, timeline, and benefits to the community.`;
      } else {
        // Generate some dummy content based on the hash
        return `Content for ${cleanHash.substring(0, 10)}`;
      }
    } catch (error) {
      console.error('Error getting IPFS content:', error);
      return '';
    }
  }

  public fromWei(wei: ethers.BigNumberish): string {
    try {
      return ethers.formatEther(wei);
    } catch (error) {
      console.error('Error converting wei to ether:', error);
      return '0';
    }
  }

  // Methods for tax collector module
  public async getAllCitizens(): Promise<any[]> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Get all citizens from the Urban Core contract
      const citizenAddresses = await this.getRoleHolders('CITIZEN_ROLE');
      const citizens = [];
      
      for (const address of citizenAddresses) {
        // Get citizen metadata if available
        const metadata = await this.getAddressMetadata(address);
        
        citizens.push({
          address,
          name: metadata?.name || 'Unknown',
          areaId: metadata?.areaId || '0',
          registrationDate: metadata?.timestamp || Date.now() / 1000
        });
      }
      
      return citizens;
    } catch (error) {
      console.error('Error getting all citizens:', error);
      return [];
    }
  }

  public async getTaxCollectionStats(): Promise<any> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // In a real implementation, this would call a contract method
      // For now, return mock statistics
      return {
        totalAssessments: 75,
        totalCollected: ethers.parseEther('150'),
        totalPending: ethers.parseEther('50'),
        collectionRate: 75, // percentage
        paymentCount: 120
      };
    } catch (error) {
      console.error('Error getting tax collection stats:', error);
      return {
        totalAssessments: 0,
        totalCollected: ethers.parseEther('0'),
        totalPending: ethers.parseEther('0'),
        collectionRate: 0,
        paymentCount: 0
      };
    }
  }

  // Implementation of missing methods for citizen module
  public async getUserGrievances(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          title: 'Road pothole on Main Street',
          description: 'Large pothole causing traffic hazards',
          status: 0, // 0=pending, 1=validated, 2=assigned, 3=resolved, 4=rejected
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago
          lastUpdated: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
          assignedTo: '0x0000000000000000000000000000000000000000',
          resolvedBy: null,
          resolvedAt: null,
          images: ['ipfs://QmHash1', 'ipfs://QmHash2']
        },
        {
          id: '2',
          title: 'Broken streetlight on Oak Avenue',
          description: 'Streetlight non-functional for 2 weeks causing safety concerns',
          status: 2, // assigned
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 10, // 10 days ago
          lastUpdated: Math.floor(Date.now() / 1000) - 86400 * 1, // 1 day ago
          assignedTo: '0x1234567890123456789012345678901234567890',
          resolvedBy: null,
          resolvedAt: null,
          images: ['ipfs://QmHash3']
        }
      ];
    } catch (error: any) {
      console.error(`Error getting user grievances for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async submitGrievance(grievanceData: any): Promise<boolean> {
    try {
      if (!this.grievanceHubContract) await this.initContracts();
      if (!this.grievanceHubContract) throw new Error('Grievance Hub contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.GrievanceHub,
          'submitGrievance',
          [
            grievanceData.title,
            grievanceData.description,
            grievanceData.location || '',
            grievanceData.images || []
          ]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.grievanceHubContract['submitGrievance'](
          grievanceData.title,
          grievanceData.description,
          grievanceData.location || '',
          grievanceData.images || []
        );
        await tx.wait();
        return true;
      }
    } catch (error: any) {
      console.error('Error submitting grievance:', error);
      return false;
    }
  }
  
  public async getLocalProjects(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          title: 'Community Park Renovation',
          description: 'Renovation of local park with new equipment',
          budget: ethers.parseEther('10'),
          currentFunding: ethers.parseEther('6.5'),
          status: 'active',
          location: 'Main Street Park',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
          creator: '0x1234567890123456789012345678901234567890',
          upvotes: 24,
          hasUserUpvoted: false
        },
        {
          id: '2',
          title: 'Street Lighting Upgrade',
          description: 'Replacing old lights with energy-efficient LED lights',
          budget: ethers.parseEther('5'),
          currentFunding: ethers.parseEther('5'),
          status: 'funded',
          location: 'Oak Avenue',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 15, // 15 days ago
          creator: '0x2345678901234567890123456789012345678901',
          upvotes: 42,
          hasUserUpvoted: true
        }
      ];
    } catch (error: any) {
      console.error(`Error getting local projects for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async upvoteProject(projectId: number): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.ProjectRegistry,
          'upvoteProject',
          [projectId]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.projectRegistryContract['upvoteProject'](projectId);
        await tx.wait();
        return true;
      }
    } catch (error: any) {
      console.error(`Error upvoting project ${projectId}:`, error);
      return false;
    }
  }
  
  public async getUserTaxAssessments(userAddress: string | null): Promise<any[]> {
    try {
      if (!userAddress) return [];
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Mock implementation - to be replaced with actual contract call
      return [
        {
          id: '1',
          propertyId: '101',
          amount: ethers.parseEther('1.2'),
          dueDate: Math.floor(Date.now() / 1000) + 86400 * 15, // 15 days from now
          isPaid: false,
          year: 2023,
          description: 'Annual property tax',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 10 // 10 days ago
        },
        {
          id: '2',
          propertyId: '102',
          amount: ethers.parseEther('0.8'),
          dueDate: Math.floor(Date.now() / 1000) - 86400 * 5, // 5 days ago (overdue)
          isPaid: false,
          year: 2023,
          description: 'Special assessment for road maintenance',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 20 // 20 days ago
        },
        {
          id: '3',
          propertyId: '101',
          amount: ethers.parseEther('1.5'),
          dueDate: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago
          isPaid: true,
          paymentDate: Math.floor(Date.now() / 1000) - 86400 * 65, // paid 65 days ago
          year: 2022,
          description: 'Annual property tax',
          createdAt: Math.floor(Date.now() / 1000) - 86400 * 120 // 120 days ago
        }
      ];
    } catch (error: any) {
      console.error(`Error getting tax assessments for ${userAddress}:`, error);
      return [];
    }
  }
  
  public async payTax(assessmentId: number, amount: string): Promise<any> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      const amountWei = ethers.parseEther(amount);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.TaxModule,
          'payTax',
          [assessmentId, amountWei.toString()]
        );
        return {
          success: !!hash,
          hash: hash,
          receipt: hash ? { id: Date.now().toString(), amount: amount } : null
        };
      } else {
        // Direct transaction
        const tx = await this.taxModuleContract['payTax'](assessmentId, amountWei);
        const receipt = await tx.wait();
        return {
          success: true,
          hash: receipt.hash,
          receipt: { id: Date.now().toString(), amount: amount }
        };
      }
    } catch (error: any) {
      console.error(`Error paying tax for assessment ${assessmentId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  public async createTaxAssessment(assessment: {
    citizenAddress: string;
    propertyId: string;
    amount: string;
    dueDate: number;
    year: number;
    description?: string;
    quarter?: number; // Changed from string to number to match component usage
    lateFee?: string;
    penaltyRate?: number;
  }): Promise<boolean> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Convert amount from string to BigNumber (ethers)
      const amountWei = ethers.parseEther(assessment.amount);
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        // Use meta transaction
        const hash = await this.sendMetaTransaction(
          environment.contracts.TaxModule,
          'createTaxAssessment',
          [
            assessment.citizenAddress,
            assessment.propertyId,
            amountWei.toString(),
            assessment.dueDate.toString(),
            assessment.year.toString(),
            assessment.description || ''
          ]
        );
        return !!hash;
      } else {
        // Direct transaction
        const tx = await this.taxModuleContract['createTaxAssessment'](
          assessment.citizenAddress,
          assessment.propertyId,
          amountWei,
          assessment.dueDate,
          assessment.year,
          assessment.description || ''
        );
        await tx.wait();
        return true;
      }
    } catch (error) {
      console.error('Error creating tax assessment:', error);
      return false;
    }
  }

  public async getCitizenInfo(address: string): Promise<any> {
    try {
      if (!this.urbanCoreContract) await this.initContracts();
      if (!this.urbanCoreContract) throw new Error('Urban Core contract not initialized');
      
      // Check if address has citizen role
      const isCitizen = await this.hasRole('CITIZEN_ROLE', address);
      if (!isCitizen) {
        console.warn(`Address ${address} is not a registered citizen`);
        return null;
      }
      
      // Get citizen metadata
      const metadata = await this.getAddressMetadata(address);
      
      // Get area details if available
      let areaDetails: { name?: string; id?: string; adminHead?: string; citizenCount?: string; metadata?: string; } = {};
      if (metadata?.areaId) {
        areaDetails = await this.getAreaDetails(metadata.areaId);
      }
      
      return {
        address,
        name: metadata?.name || 'Unknown',
        areaId: metadata?.areaId || '0',
        areaName: areaDetails?.name || 'Unknown Area',
        registrationDate: metadata?.timestamp ? new Date(Number(metadata.timestamp) * 1000) : new Date(),
        properties: metadata?.properties || []
      };
    } catch (error) {
      console.error(`Error getting citizen info for ${address}:`, error);
      return null;
    }
  }

  public async getTaxPaymentHistory(address: string): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get all payments for this citizen
      const paymentCount = await this.taxModuleContract['getPaymentCountForCitizen'](address);
      const payments = [];
      
      for (let i = 0; i < paymentCount; i++) {
        const paymentId = await this.taxModuleContract['getCitizenPaymentIdAtIndex'](address, i);
        const payment = await this.taxModuleContract['getPayment'](paymentId);
        
        payments.push({
          id: paymentId.toString(),
          amount: ethers.formatEther(payment.amount),
          timestamp: new Date(Number(payment.timestamp) * 1000),
          assessmentId: payment.assessmentId.toString(),
          citizen: payment.citizen,
          receiptId: payment.receiptId.toString()
        });
      }
      
      return payments;
    } catch (error) {
      console.error(`Error getting tax payment history for ${address}:`, error);
      return [];
    }
  }

  public async getPendingTaxAssessments(
    year?: number,
    citizenAddress?: string
  ): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // If citizenAddress is provided, get assessments for that citizen only
      if (citizenAddress) {
        const assessmentCount = await this.taxModuleContract['getTaxAssessmentCountForCitizen'](citizenAddress);
        const assessments = [];
        
        for (let i = 0; i < assessmentCount; i++) {
          const id = await this.taxModuleContract['getCitizenTaxAssessmentIdAtIndex'](citizenAddress, i);
          const assessment = await this.taxModuleContract['getTaxAssessment'](id);
          
          // Skip if paid or if year doesn't match (if year is specified)
          if (assessment.paid || (year !== undefined && assessment.year !== year)) {
            continue;
          }
          
          assessments.push({
            id: id.toString(),
            amount: ethers.formatEther(assessment.amount),
            year: assessment.year,
            paid: assessment.paid,
            dueDate: new Date(Number(assessment.dueDate) * 1000),
            citizen: assessment.citizen,
            propertyId: assessment.propertyId,
            description: assessment.description || ''
          });
        }
        
        return assessments;
      } 
      // Otherwise, get all pending assessments for the specified year
      else {
        const pendingCount = await this.taxModuleContract['getPendingAssessmentCount'](year || 0);
        const assessments = [];
        
        for (let i = 0; i < pendingCount; i++) {
          const id = await this.taxModuleContract['getPendingAssessmentAtIndex'](i, year || 0);
          const assessment = await this.taxModuleContract['getTaxAssessment'](id);
          
          assessments.push({
            id: id.toString(),
            amount: ethers.formatEther(assessment.amount),
            year: assessment.year,
            paid: false, // Must be pending since we're calling getPendingAssessmentAtIndex
            dueDate: new Date(Number(assessment.dueDate) * 1000),
            citizen: assessment.citizen,
            propertyId: assessment.propertyId,
            description: assessment.description || ''
          });
        }
        
        return assessments;
      }
    } catch (error) {
      console.error('Error getting pending tax assessments:', error);
      return [];
    }
  }

  public async getAllTaxPayments(): Promise<any[]> {
    try {
      if (!this.taxModuleContract) await this.initContracts();
      if (!this.taxModuleContract) throw new Error('Tax Module contract not initialized');
      
      // Get total payment count
      const paymentCount = await this.taxModuleContract['getTotalPaymentCount']();
      const payments = [];
      
      for (let i = 0; i < paymentCount; i++) {
        const paymentId = await this.taxModuleContract['getPaymentIdAtIndex'](i);
        const payment = await this.taxModuleContract['getPayment'](paymentId);
        
        // Get citizen info for this payment
        const citizenInfo = await this.getCitizenInfo(payment.citizen);
        
        payments.push({
          id: paymentId.toString(),
          amount: ethers.formatEther(payment.amount),
          timestamp: new Date(Number(payment.timestamp) * 1000),
          assessmentId: payment.assessmentId.toString(),
          citizen: payment.citizen,
          citizenName: citizenInfo?.name || 'Unknown',
          receiptId: payment.receiptId.toString()
        });
      }
      
      return payments;
    } catch (error) {
      console.error('Error getting all tax payments:', error);
      return [];
    }
  }

  // Project management methods
  public async getManagerProjects(managerAddress: string): Promise<number[]> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // In a real implementation, this would call a contract method to get all project IDs
      // For now, return mock data
      return [1, 2, 3, 4, 5];
    } catch (error) {
      console.error('Error getting manager projects:', error);
      return [];
    }
  }
  
  public async getRemainingFunds(projectId: number): Promise<string> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      const project = await this.getProject(projectId);
      if (!project) return '0';
      
      // Calculate remaining funds (budget - released)
      const budget = project.fundingGoal || project.budget || ethers.parseEther('0');
      const released = project.released || ethers.parseEther('0');
      const remaining = budget - released;
      
      return this.fromWei(remaining);
    } catch (error) {
      console.error(`Error getting remaining funds for project ${projectId}:`, error);
      return '0';
    }
  }
  
  public async getMilestone(projectId: number, milestoneIndex: number): Promise<any> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // In a real implementation, this would call a contract method to get milestone data
      // For now, return mock data
      const milestoneData = [
        {
          title: 'Project Initiation',
          description: 'Setting up the project and initial planning',
          funds: ethers.parseEther('2.5'),
          completed: true,
          releaseDate: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 20 // 20 days ago
        },
        {
          title: 'Phase 1 Development',
          description: 'Implementation of core features',
          funds: ethers.parseEther('2.5'),
          completed: true,
          releaseDate: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 10 // 10 days ago
        },
        {
          title: 'Phase 2 Development',
          description: 'Implementation of advanced features',
          funds: ethers.parseEther('2.5'),
          completed: false,
          releaseDate: 0
        },
        {
          title: 'Final Release',
          description: 'Final testing and project completion',
          funds: ethers.parseEther('2.5'),
          completed: false,
          releaseDate: 0
        }
      ];
      
      if (milestoneIndex < 0 || milestoneIndex >= milestoneData.length) {
        throw new Error('Invalid milestone index');
      }
      
      return milestoneData[milestoneIndex];
    } catch (error) {
      console.error(`Error getting milestone for project ${projectId} at index ${milestoneIndex}:`, error);
      return null;
    }
  }

  public convertToWei(amount: string): ethers.BigNumberish {
    try {
      return ethers.parseEther(amount);
    } catch (error) {
      console.error('Error converting to wei:', error);
      return ethers.parseEther('0');
    }
  }

  // Overloaded createProject method with separate parameters (for AdminHead module)
  public async createProject(
    titleIpfsHash: string,
    descriptionIpfsHash: string,
    budgetInWei: string,
    totalMilestones: number,
    managerAddress: string,
    areaId: string,
    initialFundingInWei: string
  ): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Mock implementation for AdminHead module
      console.log(`Creating project with title hash ${titleIpfsHash}, manager ${managerAddress}, in area ${areaId}`);
      console.log(`Budget: ${budgetInWei}, initial funding: ${initialFundingInWei}, milestones: ${totalMilestones}`);
      
      return true;
    } catch (error) {
      console.error('Error creating project:', error);
      return false;
    }
  }
  
  // Original createProject method with project data object
  public async createProjectFromData(projectData: {
    title: string;
    description: string;
    location: string;
    budget: string;
    timelineInDays?: number;
    documents?: string;
    milestones?: {
      title: string;
      description: string;
      funds: string;
    }[];
  }): Promise<boolean> {
    try {
      if (!this.projectRegistryContract) await this.initContracts();
      if (!this.projectRegistryContract) throw new Error('Project Registry contract not initialized');
      
      // Check if we should use meta-transactions
      const useMeta = await this.shouldUseMetaTransaction();
      
      if (useMeta) {
        console.log('Using meta-transaction for project creation');
        // In a real implementation, this would use meta-transactions
        // For mock purposes, we'll just simulate a successful creation
        console.log('Creating project via meta-transaction:', projectData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate blockchain delay
      } else {
        // Direct transaction (simplified mock)
        // In a real implementation, we would call the contract method directly
        console.log('Creating new project:', projectData);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate blockchain delay
      }
      
      return true;
    } catch (error) {
      console.error('Error creating project:', error);
      return false;
    }
  }
}
