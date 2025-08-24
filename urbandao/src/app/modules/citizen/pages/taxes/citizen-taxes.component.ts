import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface TaxAssessment {
  id: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  paymentDate?: Date;
  receiptId?: string;
  type: string;
  year: number;
  period: string;
  description: string;
}

@Component({
  selector: 'app-citizen-taxes',
  templateUrl: './citizen-taxes.component.html',
  styleUrls: ['./citizen-taxes.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class CitizenTaxesComponent implements OnInit {
  userAddress: string | null = null;
  
  taxAssessments: TaxAssessment[] = [];
  loading = true;
  error: string | null = null;
  currentDate: Date = new Date();
  
  // Tax payment
  selectedAssessment: TaxAssessment | null = null;
  isProcessingPayment = false;
  paymentSuccess = false;
  paymentError: string | null = null;

  // Filters
  filterYear: number = new Date().getFullYear();
  filterStatus: string = 'all';
  
  constructor(
    private contractService: ContractService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.fetchTaxAssessments();
      }
    });
  }
  
  async fetchTaxAssessments(): Promise<void> {
    if (!this.userAddress) return;
    
    this.loading = true;
    this.error = null;
    
    try {
      // Call contract to get tax assessments
      const assessments = await this.contractService.getUserTaxAssessments(this.userAddress);
      
      if (assessments) {
        this.taxAssessments = assessments.map((a: any) => ({
          id: a.id,
          amount: a.amount,
          dueDate: new Date(a.dueDate * 1000),
          isPaid: a.isPaid,
          paymentDate: a.paymentDate ? new Date(a.paymentDate * 1000) : undefined,
          receiptId: a.receiptId,
          type: a.type,
          year: a.year,
          period: a.period,
          description: a.description
        }));
        
        // Apply filters initially
        this.applyFilters();
      }
    } catch (error: any) {
      console.error('Error fetching tax assessments:', error);
      this.error = error.message || 'Failed to fetch tax assessments. Please try again later.';
    } finally {
      this.loading = false;
    }
  }
  
  applyFilters(): void {
    let filtered = [...this.taxAssessments];
    
    // Apply year filter
    if (this.filterYear) {
      filtered = filtered.filter(a => a.year === this.filterYear);
    }
    
    // Apply status filter
    if (this.filterStatus === 'paid') {
      filtered = filtered.filter(a => a.isPaid);
    } else if (this.filterStatus === 'unpaid') {
      filtered = filtered.filter(a => !a.isPaid);
    }
    
    // Sort by due date (most recent first)
    filtered.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
    
    this.taxAssessments = filtered;
  }
  
  selectAssessmentForPayment(assessment: TaxAssessment): void {
    if (assessment.isPaid) return;
    
    this.selectedAssessment = assessment;
    this.paymentSuccess = false;
    this.paymentError = null;
  }
  
  closePaymentModal(): void {
    this.selectedAssessment = null;
    this.paymentError = null;
    this.paymentSuccess = false;
  }
  
  async payTax(): Promise<void> {
    if (!this.selectedAssessment || !this.userAddress) return;
    
    this.isProcessingPayment = true;
    this.paymentError = null;
    
    try {
      // Call contract to pay tax
      await this.contractService.payTax(parseInt(this.selectedAssessment.id, 10), this.selectedAssessment.amount.toString());
      
      // Mark payment as successful
      this.paymentSuccess = true;
      
      // Refresh tax assessments after a short delay
      setTimeout(() => {
        this.fetchTaxAssessments();
        this.closePaymentModal();
      }, 3000);
      
    } catch (error: any) {
      console.error('Error paying tax:', error);
      this.paymentError = error.message || 'Payment failed. Please try again later.';
    } finally {
      this.isProcessingPayment = false;
    }
  }
  
  viewReceipt(receiptId: string): void {
    // In a real app, this would navigate to a receipt view or open a modal
    console.log('Viewing receipt:', receiptId);
    window.open(`https://sepolia.etherscan.io/tx/${receiptId}`, '_blank');
  }
  
  // Helper methods
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  formatCurrency(amount: number): string {
    return amount.toFixed(4) + ' ETH';
  }
  
  getStatusClass(isPaid: boolean, dueDate: Date): string {
    if (isPaid) {
      return 'status-paid';
    } else if (dueDate < new Date()) {
      return 'status-overdue';
    } else {
      return 'status-due';
    }
  }
  
  getStatusText(isPaid: boolean, dueDate: Date): string {
    if (isPaid) {
      return 'Paid';
    } else if (dueDate < new Date()) {
      return 'Overdue';
    } else {
      return 'Due';
    }
  }
  
  refreshAssessments(): void {
    this.fetchTaxAssessments();
  }
  
  // Get available years for filtering
  get availableYears(): number[] {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    
    // Add current year and past 2 years
    years.add(currentYear);
    years.add(currentYear - 1);
    years.add(currentYear - 2);
    
    // Add years from assessments
    this.taxAssessments.forEach(a => years.add(a.year));
    
    return Array.from(years).sort((a, b) => b - a); // Sort descending
  }
}
