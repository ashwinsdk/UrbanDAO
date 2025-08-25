import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/role.model';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-citizen-verification',
  templateUrl: './citizen-verification.component.html',
  styleUrls: ['./citizen-verification.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule]
})
export class CitizenVerificationComponent implements OnInit {
  pendingVerifications: any[] = [];
  loading = true;
  error: string | null = null;
  selectedCitizen: any = null;
  feedback: string = '';

  constructor(
    private contractService: ContractService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadPendingVerifications();
  }

  async loadPendingVerifications() {
    try {
      this.loading = true;
      this.error = null;
      
      // Get pending verifications - use the existing contract method for role requests
      // as these are effectively citizens waiting for verification
      const pendingRequests = await this.contractService.getRoleRequests(UserRole.CITIZEN_ROLE);
      
      // Only show pending requests
      this.pendingVerifications = pendingRequests.filter(request => 
        request.status === 'pending' && 
        request.role === 'citizen'
      );
      
      console.log('Loaded pending verifications:', this.pendingVerifications);
    } catch (error: any) {
      console.error('Error loading pending verifications:', error);
      this.error = error.message || 'Failed to load pending verifications';
    } finally {
      this.loading = false;
    }
  }

  selectCitizen(citizen: any) {
    this.selectedCitizen = citizen;
    this.feedback = '';
  }

  async approveCitizen() {
    if (!this.selectedCitizen) return;
    
    try {
      this.loading = true;
      
      // Check if TX_PAYER role holders exist for gasless transactions
      const txPayers = await this.contractService.getRoleHolders(UserRole.TX_PAYER_ROLE);
      const useMeta = txPayers && txPayers.length > 0;
      let result;
      
      if (useMeta) {
        result = await this.contractService.sendMetaTransaction(
          environment.contracts.UrbanCore,
          'approveRoleRequest',
          [this.selectedCitizen.id]
        );
      } else {
        result = await this.contractService.approveRoleRequest(this.selectedCitizen.id);
      }
      
      if (result) {
        // Remove the approved citizen from the list
        this.pendingVerifications = this.pendingVerifications.filter(
          c => c.id !== this.selectedCitizen.id
        );
        this.selectedCitizen = null;
        this.feedback = '';
      } else {
        this.error = 'Failed to approve citizen. Please try again.';
      }
    } catch (error: any) {
      console.error('Error approving citizen:', error);
      this.error = error.message || 'Failed to approve citizen';
    } finally {
      this.loading = false;
    }
  }

  async rejectCitizen() {
    if (!this.selectedCitizen || !this.feedback) return;
    
    try {
      this.loading = true;
      
      // Check if TX_PAYER role holders exist for gasless transactions
      const txPayers = await this.contractService.getRoleHolders(UserRole.TX_PAYER_ROLE);
      const useMeta = txPayers && txPayers.length > 0;
      let result;
      
      if (useMeta) {
        result = await this.contractService.sendMetaTransaction(
          environment.contracts.UrbanCore,
          'rejectCitizen', // Use the correct contract method
          [this.selectedCitizen.id, this.feedback]
        );
      } else {
        // Pass the feedback parameter to the rejectRoleRequest method
        result = await this.contractService.rejectRoleRequest(this.selectedCitizen.id, this.feedback);
      }
      
      if (result) {
        // Remove the rejected citizen from the list
        this.pendingVerifications = this.pendingVerifications.filter(
          c => c.id !== this.selectedCitizen.id
        );
        this.selectedCitizen = null;
        this.feedback = '';
      } else {
        this.error = 'Failed to reject citizen. Please try again.';
      }
    } catch (error: any) {
      console.error('Error rejecting citizen:', error);
      this.error = error.message || 'Failed to reject citizen';
    } finally {
      this.loading = false;
    }
  }

  refreshData() {
    this.loadPendingVerifications();
  }

  closeDetails() {
    this.selectedCitizen = null;
    this.feedback = '';
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  truncateAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}
