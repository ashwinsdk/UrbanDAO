import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserFeedback } from '../user.service';
import { AuthService } from '../../auth/auth.service';
import { SolanaService } from '../../shared/services';
import { Router } from '@angular/router';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './status.html',
  styleUrl: './status.css'
})
export class Status implements OnInit {
  isConnected = false;
  publicKey: string | null = null;
  isLoading = true;
  
  // Tab management
  activeTab: 'grievances' | 'payments' | 'feedback' = 'grievances';
  
  // Data for each tab
  grievances: any[] = [];
  payments: any[] = [];
  feedback: UserFeedback[] = [];
  
  // Search and filter
  searchQuery = '';
  statusFilter = 'all';
  dateFilter = 'all';
  
  // Filtered data
  filteredGrievances: any[] = [];
  filteredPayments: any[] = [];
  filteredFeedback: any[] = [];
  
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private solanaService: SolanaService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    // Check wallet connection status using SolanaService (primary) with AuthService fallback
    const isConnected = this.solanaService.isWalletConnected();
    this.isConnected = isConnected;
    
    if (isConnected) {
      this.publicKey = this.solanaService.getPublicKey();
      this.loadAllData();
    } else {
      // Fallback to AuthService
      this.authService.connected$.subscribe(connected => {
        this.isConnected = connected;
        if (connected) {
          this.loadAllData();
        } else {
          this.isLoading = false;
        }
      });
      
      this.authService.publicKey$.subscribe(publicKey => {
        this.publicKey = publicKey;
      });
    }
  }
  
  // Load all data for the connected user
  loadAllData(): void {
    this.isLoading = true;
    
    // Load grievances
    this.userService.getGrievances().subscribe(grievances => {
      this.grievances = grievances;
      this.applyFilters();
      this.isLoading = false;
    });
    
    // Load payments
    this.userService.getTaxPayments().subscribe(payments => {
      this.payments = payments;
      this.applyFilters();
    });
    
    // Load feedback from blockchain via UserService
    this.userService.getFeedback().subscribe({
      next: (feedback) => {
        this.feedback = feedback;
        this.applyFilters();
      },
      error: (error) => {
        console.error('Failed to load feedback:', error);
        this.feedback = [];
        this.applyFilters();
      }
    });
  }
  
  // Switch between tabs
  setActiveTab(tab: 'grievances' | 'payments' | 'feedback'): void {
    this.activeTab = tab;
  }
  
  // Apply filters to all data
  applyFilters(): void {
    // Filter grievances
    this.filteredGrievances = this.grievances.filter(item => {
      return this.filterItem(item);
    });
    
    // Filter payments
    this.filteredPayments = this.payments.filter(item => {
      return this.filterItem(item);
    });
    
    // Filter feedback
    this.filteredFeedback = this.feedback.filter(item => {
      return this.filterItem(item);
    });
  }
  
  // Generic filter function for all item types
  filterItem(item: any): boolean {
    // Status filter
    if (this.statusFilter !== 'all' && item.status !== this.statusFilter) {
      return false;
    }
    
    // Date filter
    if (this.dateFilter !== 'all') {
      const itemDate = new Date(item.submittedDate || item.date);
      const now = new Date();
      
      switch (this.dateFilter) {
        case 'today':
          if (!this.isToday(itemDate)) return false;
          break;
        case 'week':
          if (!this.isWithinDays(itemDate, 7)) return false;
          break;
        case 'month':
          if (!this.isWithinDays(itemDate, 30)) return false;
          break;
      }
    }
    
    // Search query
    if (this.searchQuery.trim() !== '') {
      const query = this.searchQuery.toLowerCase();
      const matchesId = item.id?.toLowerCase().includes(query);
      const matchesSubject = item.subject?.toLowerCase().includes(query) || item.category?.toLowerCase().includes(query);
      const matchesDescription = item.description?.toLowerCase().includes(query) || item.message?.toLowerCase().includes(query);
      
      if (!(matchesId || matchesSubject || matchesDescription)) {
        return false;
      }
    }
    
    return true;
  }
  
  // Date helper functions
  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
  
  isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  }
  
  // Reset all filters
  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.dateFilter = 'all';
    this.applyFilters();
  }
  
  // Format date for display
  formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // Get status class for styling
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending':
      case 'submitted':
        return 'status-pending';
      case 'in progress':
      case 'processing':
        return 'status-processing';
      case 'resolved':
      case 'completed':
      case 'paid':
      case 'success':
        return 'status-success';
      case 'rejected':
      case 'failed':
        return 'status-error';
      case 'acknowledged':
        return 'status-info';
      default:
        return '';
    }
  }
  
  // Navigate to create new item based on active tab
  createNew(): void {
    switch (this.activeTab) {
      case 'grievances':
        this.router.navigate(['/user/file-grievance']);
        break;
      case 'payments':
        this.router.navigate(['/user/pay-tax']);
        break;
      case 'feedback':
        this.router.navigate(['/user/feedback']);
        break;
    }
  }
  
  // Format wallet address for display
  formatWalletAddress(address: string | null): string {
    if (!address) return 'Not connected';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  }
}
