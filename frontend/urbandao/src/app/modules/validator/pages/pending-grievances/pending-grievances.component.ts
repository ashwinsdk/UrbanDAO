import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface PendingGrievance {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  createdAt: Date;
  citizenAddress: string;
  citizenName?: string;
  urgent: boolean;
  imageUrls?: string[];
}

@Component({
  selector: 'app-pending-grievances',
  templateUrl: './pending-grievances.component.html',
  styleUrls: ['./pending-grievances.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule]
})
export class PendingGrievancesComponent implements OnInit {
  pendingGrievances: PendingGrievance[] = [];
  filteredGrievances: PendingGrievance[] = [];
  searchControl = new FormControl('');
  typeFilter = new FormControl('all');
  urgentFilter = new FormControl('all');
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
    this.loadPendingGrievances();
    
    // Set up search filtering with debounce
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
      });
      
    // Apply filters when filter controls change
    this.typeFilter.valueChanges.subscribe(() => this.applyFilters());
    this.urgentFilter.valueChanges.subscribe(() => this.applyFilters());
    this.sortOption.valueChanges.subscribe(() => this.applyFilters());
  }

  async loadPendingGrievances(): Promise<void> {
    try {
      this.loading = true;
      const grievances = await this.contractService.getPendingGrievances();
      
      if (grievances) {
        this.pendingGrievances = grievances.map(g => ({
          id: g.id,
          title: g.title,
          description: g.description,
          location: g.location,
          type: g.type,
          createdAt: new Date(g.timestamp * 1000),
          citizenAddress: g.citizenAddress,
          citizenName: g.citizenName,
          urgent: g.urgent,
          imageUrls: g.imageUrls
        }));
        
        this.applyFilters();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading pending grievances:', error);
      this.error = error.message || 'Failed to load pending grievances. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    let filtered = [...this.pendingGrievances];
    
    // Apply search filter
    const searchTerm = this.searchControl.value?.toLowerCase();
    if (searchTerm) {
      filtered = filtered.filter(g => 
        g.title.toLowerCase().includes(searchTerm) ||
        g.description.toLowerCase().includes(searchTerm) ||
        g.location.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply type filter
    const typeFilter = this.typeFilter.value;
    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter(g => g.type === typeFilter);
    }
    
    // Apply urgent filter
    const urgentFilter = this.urgentFilter.value;
    if (urgentFilter === 'urgent') {
      filtered = filtered.filter(g => g.urgent);
    } else if (urgentFilter === 'regular') {
      filtered = filtered.filter(g => !g.urgent);
    }
    
    // Apply sorting
    const sortOption = this.sortOption.value;
    if (sortOption === 'newest') {
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sortOption === 'oldest') {
      filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    
    this.filteredGrievances = filtered;
  }

  navigateToGrievanceReview(grievanceId: string): void {
    this.router.navigate(['/validator/grievances/review', grievanceId]);
  }
  
  refreshGrievances(): void {
    this.loadPendingGrievances();
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
}
