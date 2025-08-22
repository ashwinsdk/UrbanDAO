import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface TaxpayerInfo {
  address: string;
  name?: string;
  registeredDate?: Date;
  propertyId?: string;
  location?: string;
  totalPaid: string;
  paymentHistory: any[];
  pendingAssessments: any[];
}

@Component({
  selector: 'app-taxpayer-details',
  templateUrl: './taxpayer-details.component.html',
  styleUrls: ['./taxpayer-details.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule]
})
export class TaxpayerDetailsComponent implements OnInit {
  userAddress: string | null = null;
  taxpayerAddress: string | null = null;
  
  taxpayerInfo: TaxpayerInfo = {
    address: '',
    totalPaid: '0',
    paymentHistory: [],
    pendingAssessments: []
  };
  
  loading = true;
  error: string | null = null;
  showFullHistory = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
      }
    });
    
    this.route.paramMap.subscribe(params => {
      const address = params.get('address');
      
      if (address) {
        this.taxpayerAddress = address;
        this.loadTaxpayerDetails(address);
      } else {
        this.error = 'Invalid taxpayer address';
        this.loading = false;
      }
    });
  }

  async loadTaxpayerDetails(address: string): Promise<void> {
    try {
      this.loading = true;
      
      // Get citizen/taxpayer info
      const citizenInfo = await this.contractService.getCitizenInfo(address);
      
      if (citizenInfo) {
        // Get tax payment history
        const paymentHistory = await this.contractService.getTaxPaymentHistory(address);
        
        // Get pending tax assessments
        const pendingAssessments = await this.contractService.getPendingTaxAssessments(undefined, address);
        
        // Calculate total paid
        const totalPaid = paymentHistory.reduce((sum: number, payment: any) => {
          return sum + parseFloat(payment.amount);
        }, 0).toFixed(4);
        
        this.taxpayerInfo = {
          address,
          name: citizenInfo.name,
          registeredDate: citizenInfo.registeredDate ? new Date(citizenInfo.registeredDate * 1000) : undefined,
          propertyId: citizenInfo.propertyId,
          location: citizenInfo.location,
          totalPaid: totalPaid.toString(),
          paymentHistory,
          pendingAssessments
        };
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading taxpayer details:', error);
      this.error = error.message || 'Failed to load taxpayer details. Please try again.';
    } finally {
      this.loading = false;
    }
  }
  
  createNewAssessment(): void {
    // Store the taxpayer info in a service or use state management
    // to pre-fill the assessment form
    this.router.navigate(['/tax-collector/assessment'], { 
      state: { preselectedTaxpayer: this.taxpayerInfo } 
    });
  }
  
  viewReceipt(receiptId: string): void {
    // Implement view receipt functionality
    alert(`View tax receipt: ${receiptId}`);
  }
  
  toggleHistory(): void {
    this.showFullHistory = !this.showFullHistory;
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date | undefined | number): string {
    if (!date) return 'N/A';
    
    // If date is a number (Unix timestamp), convert to Date object
    const dateObj = typeof date === 'number' ? new Date(date * 1000) : date;
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Helper methods to create formatted date strings from timestamps
  formatTimestamp(timestamp: number): string {
    return this.formatDate(new Date(timestamp * 1000));
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID':
        return 'paid';
      case 'PENDING':
        return 'pending';
      case 'OVERDUE':
        return 'overdue';
      case 'PARTIALLY_PAID':
        return 'partially-paid';
      default:
        return '';
    }
  }
}
