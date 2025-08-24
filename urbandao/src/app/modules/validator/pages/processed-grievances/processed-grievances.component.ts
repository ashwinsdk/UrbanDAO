import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface ProcessedGrievance {
  id: string;
  title: string;
  location: string;
  type: string;
  citizenAddress: string;
  citizenName?: string;
  createdAt: Date;
  processedAt: Date;
  status: string; // VALIDATED or REJECTED
  validatorComments: string;
  validatorAddress: string;
}

@Component({
  selector: 'app-processed-grievances',
  templateUrl: './processed-grievances.component.html',
  styleUrls: ['./processed-grievances.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class ProcessedGrievancesComponent implements OnInit {
  userAddress: string | null = null;
  processedGrievances: ProcessedGrievance[] = [];
  filteredGrievances: ProcessedGrievance[] = [];
  
  // Filter and search controls
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  typeFilter = new FormControl('all');
  sortOption = new FormControl('newest');
  
  loading = true;
  error: string | null = null;
  
  grievanceTypes = [
    'All Types',
    'Infrastructure',
    'Sanitation',
    'Water Supply',
    'Electricity',
    'Public Safety',
    'Noise Pollution',
    'Road Maintenance',
    'Waste Management',
    'Other'
  ];

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadProcessedGrievances();
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
    this.typeFilter.valueChanges.subscribe(() => this.applyFilters());
    this.sortOption.valueChanges.subscribe(() => this.applyFilters());
  }

  async loadProcessedGrievances(): Promise<void> {
    if (!this.userAddress) return;
    
    try {
      this.loading = true;
      const grievances = await this.contractService.getProcessedGrievancesByValidator(this.userAddress);
      
      if (grievances) {
        this.processedGrievances = grievances.map(g => ({
          id: g.id,
          title: g.title,
          location: g.location,
          type: g.type,
          citizenAddress: g.citizenAddress,
          citizenName: g.citizenName,
          createdAt: new Date(g.timestamp * 1000),
          processedAt: new Date(g.processedTimestamp * 1000),
          status: g.status, // VALIDATED or REJECTED
          validatorComments: g.validatorComments,
          validatorAddress: g.validatorAddress
        }));
        
        this.applyFilters();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading processed grievances:', error);
      this.error = error.message || 'Failed to load processed grievances. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    let filtered = [...this.processedGrievances];
    
    // Apply search filter
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(g => 
        g.title.toLowerCase().includes(searchTerm) ||
        g.location.toLowerCase().includes(searchTerm) ||
        g.validatorComments.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply status filter
    const statusFilter = this.statusFilter.value;
    if (statusFilter === 'validated') {
      filtered = filtered.filter(g => g.status === 'VALIDATED');
    } else if (statusFilter === 'rejected') {
      filtered = filtered.filter(g => g.status === 'REJECTED');
    }
    
    // Apply type filter
    const typeFilter = this.typeFilter.value;
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(g => g.type === typeFilter);
    }
    
    // Apply sorting
    const sortOption = this.sortOption.value;
    if (sortOption === 'newest') {
      filtered.sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime());
    } else if (sortOption === 'oldest') {
      filtered.sort((a, b) => a.processedAt.getTime() - b.processedAt.getTime());
    }
    
    this.filteredGrievances = filtered;
  }

  refreshGrievances(): void {
    this.loadProcessedGrievances();
  }
  
  viewGrievanceDetails(grievanceId: string): void {
    // Navigate to grievance details (could be a shared component)
    // For now, just alert the ID
    alert(`View details for grievance: ${grievanceId}`);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  getStatusClass(status: string): string {
    return status === 'VALIDATED' ? 'validated' : 'rejected';
  }
}
