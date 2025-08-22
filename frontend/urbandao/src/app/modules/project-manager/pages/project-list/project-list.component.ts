import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

interface Project {
  id: number;
  areaId: number;
  title: string;
  description: string;
  manager: string;
  fundingGoal: string;
  escrowed: string;
  released: string;
  status: string;
  milestoneCount: number;
  currentMilestone: number;
  citizenUpvotes: number;
  createdAt: Date;
}

@Component({
  selector: 'app-project-list',
  templateUrl: './project-list.component.html',
  styleUrls: ['./project-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class ProjectListComponent implements OnInit {
  userAddress: string | null = null;
  projects: Project[] = [];
  filteredProjects: Project[] = [];
  filterForm: FormGroup;
  Math = Math; // Add Math reference for use in the template
  
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  
  loading = true;
  error: string | null = null;
  
  // Status mapping
  statusMap: { [key: number]: string } = {
    0: 'PROPOSED',
    1: 'FUNDED',
    2: 'IN_PROGRESS',
    3: 'COMPLETED',
    4: 'CANCELLED'
  };

  constructor(
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      status: ['all'],
      search: [''],
      areaId: [''],
      sortBy: ['newest']
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadProjects();
      }
    });
    
    // Apply filters when form changes
    this.filterForm.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
      });
  }

  async loadProjects(): Promise<void> {
    if (!this.userAddress) return;

    try {
      this.loading = true;
      
      // Get all projects managed by the current user
      const projectIds = await this.contractService.getManagerProjects(this.userAddress);
      
      if (projectIds && projectIds.length > 0) {
        this.projects = await Promise.all(
          projectIds.map(async (id: number) => {
            const project = await this.contractService.getProject(id);
            
            // Assuming the IPFS hashes are stored in hex format
            const title = await this.contractService.getIPFSContent(project.titleHash);
            const description = await this.contractService.getIPFSContent(project.descriptionHash);
            
            return {
              id: project.id,
              areaId: project.areaId,
              title: title || 'Unknown Project',
              description: description || 'No description available',
              manager: project.manager,
              fundingGoal: this.contractService.fromWei(project.fundingGoal),
              escrowed: this.contractService.fromWei(project.escrowed),
              released: this.contractService.fromWei(project.released),
              status: this.statusMap[project.status] || 'UNKNOWN',
              milestoneCount: project.milestoneCount,
              currentMilestone: project.currentMilestone,
              citizenUpvotes: project.citizenUpvotes,
              createdAt: new Date(project.createdAt * 1000)
            };
          })
        );
        
        this.applyFilters();
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading projects:', error);
      this.error = error.message || 'Failed to load projects. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  applyFilters(): void {
    const { status, search, areaId, sortBy } = this.filterForm.value;
    
    // Filter by status
    let filtered = this.projects;
    if (status !== 'all') {
      filtered = filtered.filter(project => project.status === status);
    }
    
    // Filter by search term (title)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(project => 
        project.title.toLowerCase().includes(searchLower) || 
        project.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by area ID
    if (areaId) {
      filtered = filtered.filter(project => project.areaId.toString() === areaId);
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'fundingHigh':
        filtered.sort((a, b) => parseFloat(b.fundingGoal) - parseFloat(a.fundingGoal));
        break;
      case 'fundingLow':
        filtered.sort((a, b) => parseFloat(a.fundingGoal) - parseFloat(b.fundingGoal));
        break;
      case 'upvotes':
        filtered.sort((a, b) => b.citizenUpvotes - a.citizenUpvotes);
        break;
    }
    
    // Update filtered projects and pagination
    this.filteredProjects = filtered;
    this.totalPages = Math.ceil(this.filteredProjects.length / this.pageSize);
    this.currentPage = 1; // Reset to first page after filter changes
  }

  navigateToProjectDetails(projectId: number): void {
    this.router.navigate(['/project-manager/project', projectId]);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PROPOSED':
        return 'proposed';
      case 'FUNDED':
        return 'funded';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'COMPLETED':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return '';
    }
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  refreshProjects(): void {
    this.loadProjects();
  }
  
  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
  
  get paginatedProjects(): Project[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredProjects.slice(startIndex, startIndex + this.pageSize);
  }
  
  get pages(): number[] {
    const pagesArray = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pagesArray.push(i);
    }
    return pagesArray;
  }
  
  resetFilters(): void {
    this.filterForm.reset({
      status: 'all',
      search: '',
      areaId: '',
      sortBy: 'newest'
    });
  }
}
