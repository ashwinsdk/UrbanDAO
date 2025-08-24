import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface GrievanceDetail {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected';
  createdAt: Date;
  lastUpdated: Date;
  location: string;
  type: string;
  images?: string[];
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  comments: {
    author: string;
    role: string;
    text: string;
    timestamp: Date;
  }[];
  statusHistory: {
    status: string;
    timestamp: Date;
    actor?: string;
    comment?: string;
  }[];
}

@Component({
  selector: 'app-grievance-detail',
  templateUrl: './grievance-detail.component.html',
  styleUrls: ['./grievance-detail.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule]
})
export class GrievanceDetailComponent implements OnInit {
  grievanceId: string = '';
  grievance: GrievanceDetail | null = null;
  userAddress: string | null = null;
  
  loading = true;
  error: string | null = null;
  
  // For adding comments
  newComment: string = '';
  isSubmittingComment = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private contractService: ContractService,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.grievanceId = id;
        
        this.authService.user$.subscribe(user => {
          if (user) {
            this.userAddress = user.address;
            this.fetchGrievanceDetails();
          }
        });
      } else {
        this.error = 'Invalid grievance ID';
        this.loading = false;
      }
    });
  }
  
  async fetchGrievanceDetails(): Promise<void> {
    this.loading = true;
    this.error = null;
    
    try {
      // Call contract to get grievance details
      const grievanceData = await this.contractService.getGrievanceById(this.grievanceId);
      
      if (grievanceData) {
        // Map contract data to UI model
        this.grievance = {
          id: grievanceData.id,
          title: grievanceData.title,
          description: grievanceData.description,
          status: this.mapContractStatusToUI(grievanceData.status),
          createdAt: new Date(grievanceData.timestamp * 1000),
          lastUpdated: new Date(grievanceData.lastUpdated * 1000),
          location: grievanceData.location,
          type: grievanceData.grievanceType,
          images: grievanceData.images,
          assignedTo: grievanceData.assignedTo,
          resolvedBy: grievanceData.resolvedBy,
          resolvedAt: grievanceData.resolvedAt ? new Date(grievanceData.resolvedAt * 1000) : undefined,
          
          // Format comments from contract events
          comments: (grievanceData.comments || []).map((comment: any) => ({
            author: comment.author,
            role: comment.role,
            text: comment.text,
            timestamp: new Date(comment.timestamp * 1000)
          })),
          
          // Format status history from contract events
          statusHistory: (grievanceData.statusHistory || []).map((event: any) => ({
            status: this.mapContractStatusToUI(event.status),
            timestamp: new Date(event.timestamp * 1000),
            actor: event.actor,
            comment: event.comment
          }))
        };
        
        // Sort status history by timestamp (newest first)
        this.grievance.statusHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      } else {
        this.error = 'Grievance not found';
      }
    } catch (error: any) {
      console.error('Error fetching grievance details:', error);
      this.error = error.message || 'Failed to fetch grievance details. Please try again later.';
    } finally {
      this.loading = false;
    }
  }
  
  // Helper method to map contract status values to UI-friendly status
  private mapContractStatusToUI(status: number): 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected' {
    const statusMap: {[key: number]: 'pending' | 'validated' | 'assigned' | 'resolved' | 'rejected'} = {
      0: 'pending',
      1: 'validated',
      2: 'assigned',
      3: 'resolved',
      4: 'rejected'
    };
    return statusMap[status] || 'pending';
  }
  
  // Status badge helpers
  getStatusClass(status: string): string {
    const statusClasses: {[key: string]: string} = {
      'pending': 'status-pending',
      'validated': 'status-validated',
      'assigned': 'status-assigned',
      'resolved': 'status-resolved',
      'rejected': 'status-rejected'
    };
    return statusClasses[status] || '';
  }
  
  getStatusLabel(status: string): string {
    const statusLabels: {[key: string]: string} = {
      'pending': 'Pending',
      'validated': 'Validated',
      'assigned': 'In Progress',
      'resolved': 'Resolved',
      'rejected': 'Rejected'
    };
    return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  }
  
  // Format dates
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Add comment
  async submitComment(): Promise<void> {
    if (!this.newComment.trim() || !this.grievanceId || !this.userAddress) {
      return;
    }
    
    this.isSubmittingComment = true;
    
    try {
      // Call contract to add comment
      await this.contractService.addGrievanceComment(this.grievanceId, this.newComment);
      
      // Clear comment field
      this.newComment = '';
      
      // Refresh grievance details to show new comment
      await this.fetchGrievanceDetails();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      this.error = error.message || 'Failed to add comment. Please try again later.';
    } finally {
      this.isSubmittingComment = false;
    }
  }
  
  // Navigation
  goBack(): void {
    this.router.navigate(['/citizen/grievances']);
  }
  
  // Format address for display
  formatAddress(address: string | undefined): string {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  // Add null checks to avoid template errors
  isGrievanceResolved(): boolean {
    return this.grievance?.status === 'resolved';
  }
}
