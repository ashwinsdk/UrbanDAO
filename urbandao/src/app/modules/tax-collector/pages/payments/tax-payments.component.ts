import { Component, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface TaxPayment {
  id: string;
  citizenAddress: string;
  citizenName?: string;
  amount: string; // in ETH or tokens
  paidOn: Date;
  dueDate: Date;
  status: string; // 'PAID', 'PENDING', 'OVERDUE', 'PARTIALLY_PAID'
  year: number;
  quarter: number;
  propertyId: string;
  receiptId?: string; // optional NFT receipt ID
}

@Component({
  selector: 'app-tax-payments',
  templateUrl: './tax-payments.component.html',
  styleUrls: ['./tax-payments.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule]
})
export class TaxPaymentsComponent implements OnInit {
  userAddress: string | null = null;
  
  allPayments: TaxPayment[] = [];
  filteredPayments: TaxPayment[] = [];
  
  // Filter and search controls
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  yearFilter = new FormControl('all');
  quarterFilter = new FormControl('all');
  sortOption = new FormControl('newest');
  
  years: number[] = [];
  quarters = [1, 2, 3, 4];
  
  loading = true;
  error: string | null = null;
  
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.initializeFilters();
        this.loadTaxPayments();
      }
    });
    
    // Set up search and filter listeners
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
      });
      
    this.statusFilter.valueChanges.subscribe(() => this.applyFilters());
    this.yearFilter.valueChanges.subscribe(() => this.applyFilters());
    this.quarterFilter.valueChanges.subscribe(() => this.applyFilters());
    this.sortOption.valueChanges.subscribe(() => this.applyFilters());
  }

  initializeFilters(): void {
    const currentYear = new Date().getFullYear();
    this.years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  }

  async loadTaxPayments(): Promise<void> {
    try {
      this.loading = true;
      const payments = await this.contractService.getAllTaxPayments();
      
      if (payments) {
        this.allPayments = payments.map(p => ({
          id: p.id,
          citizenAddress: p.citizenAddress,
          citizenName: p.citizenName,
          amount: p.amount,
          paidOn: p.paidTimestamp ? new Date(p.paidTimestamp * 1000) : new Date(0),
          dueDate: new Date(p.dueDate * 1000),
          status: this.getTaxStatus(p),
          year: p.year,
          quarter: p.quarter,
          propertyId: p.propertyId,
          receiptId: p.receiptId
        }));
        
        this.applyFilters();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading tax payments:', error);
      this.error = error.message || 'Failed to load tax payments. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  getTaxStatus(payment: any): string {
    const now = Date.now();
    
    if (payment.paid) {
      return 'PAID';
    }
    
    if (payment.partiallyPaid) {
      return 'PARTIALLY_PAID';
    }
    
    if (payment.dueDate * 1000 < now) {
      return 'OVERDUE';
    }
    
    return 'PENDING';
  }

  applyFilters(): void {
    let filtered = [...this.allPayments];
    
    // Apply search filter
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(p => 
        (p.citizenName && p.citizenName.toLowerCase().includes(searchTerm)) ||
        p.citizenAddress.toLowerCase().includes(searchTerm) ||
        p.propertyId.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply status filter
    const statusFilter = this.statusFilter.value;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    
    // Apply year filter
    const yearFilter = this.yearFilter.value;
    if (yearFilter && yearFilter !== 'all') {
      filtered = filtered.filter(p => p.year === Number(yearFilter));
    }
    
    // Apply quarter filter
    const quarterFilter = this.quarterFilter.value;
    if (quarterFilter && quarterFilter !== 'all') {
      filtered = filtered.filter(p => p.quarter === Number(quarterFilter));
    }
    
    // Apply sorting
    const sortOption = this.sortOption.value;
    if (sortOption === 'newest') {
      filtered.sort((a, b) => b.paidOn.getTime() - a.paidOn.getTime());
    } else if (sortOption === 'oldest') {
      filtered.sort((a, b) => a.paidOn.getTime() - b.paidOn.getTime());
    } else if (sortOption === 'amount_high') {
      filtered.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    } else if (sortOption === 'amount_low') {
      filtered.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
    } else if (sortOption === 'due_date') {
      filtered.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }
    
    this.totalItems = filtered.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.filteredPayments = filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }
  
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }
  
  getPaginationArray(): number[] {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (this.currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
      } else if (this.currentPage >= this.totalPages - 2) {
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
          pages.push(i);
        }
      }
    }
    
    return pages;
  }

  refreshPayments(): void {
    this.loadTaxPayments();
  }
  
  navigateToTaxpayerDetails(address: string): void {
    this.router.navigate(['/tax-collector/taxpayer', address]);
  }
  
  viewReceipt(receiptId: string): void {
    // Implement view receipt functionality
    // This could open a modal or navigate to a receipt detail page
    alert(`View tax receipt: ${receiptId}`);
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date): string {
    if (!date || date.getTime() === 0) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
