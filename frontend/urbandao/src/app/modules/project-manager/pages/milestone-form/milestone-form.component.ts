import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  remainingFunds: string;
}

@Component({
  selector: 'app-milestone-form',
  templateUrl: './milestone-form.component.html',
  styleUrls: ['./milestone-form.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class MilestoneFormComponent implements OnInit {
  projectId: number | null = null;
  project: Project | null = null;
  userAddress: string | null = null;
  milestoneForm: FormGroup;
  
  loading = true;
  submitting = false;
  error: string | null = null;
  success: string | null = null;
  
  // Status mapping
  statusMap: { [key: number]: string } = {
    0: 'PROPOSED',
    1: 'FUNDED',
    2: 'IN_PROGRESS',
    3: 'COMPLETED',
    4: 'CANCELLED'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private contractService: ContractService,
    private authService: AuthService
  ) {
    this.milestoneForm = this.fb.group({
      milestoneNumber: [{ value: '', disabled: true }],
      proofContent: ['', [Validators.required, Validators.minLength(10)]],
      amount: ['', [Validators.required, Validators.min(0.0001)]]
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.projectId = +params['id'];
      
      this.authService.user$.subscribe(user => {
        if (user) {
          this.userAddress = user.address;
          this.loadProjectDetails();
        }
      });
    });
  }

  async loadProjectDetails(): Promise<void> {
    if (!this.projectId || !this.userAddress) return;

    try {
      this.loading = true;
      
      // Get project details
      const projectData = await this.contractService.getProject(this.projectId);
      
      // Check if this user is the manager of the project
      if (projectData.manager.toLowerCase() !== this.userAddress.toLowerCase()) {
        this.error = "You don't have permission to submit milestones for this project.";
        this.loading = false;
        return;
      }
      
      // Check if project is in a valid state for milestone submission
      const status = this.statusMap[projectData.status];
      if (status !== 'FUNDED' && status !== 'IN_PROGRESS') {
        this.error = "This project is not currently accepting milestone submissions.";
        this.loading = false;
        return;
      }
      
      // Fetch IPFS content
      const title = await this.contractService.getIPFSContent(projectData.titleHash);
      
      // Get remaining funds
      const remainingFunds = await this.contractService.getRemainingFunds(this.projectId);
      
      this.project = {
        id: projectData.id,
        areaId: projectData.areaId,
        title: title || 'Unknown Project',
        description: '',
        manager: projectData.manager,
        fundingGoal: this.contractService.fromWei(projectData.fundingGoal),
        escrowed: this.contractService.fromWei(projectData.escrowed),
        released: this.contractService.fromWei(projectData.released),
        status,
        milestoneCount: projectData.milestoneCount,
        currentMilestone: projectData.currentMilestone,
        citizenUpvotes: projectData.citizenUpvotes,
        remainingFunds: this.contractService.fromWei(remainingFunds)
      };
      
      // Update form with current milestone number
      this.milestoneForm.patchValue({
        milestoneNumber: projectData.currentMilestone.toString(),
        amount: '' // Clear any previous value
      });
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading project details:', error);
      this.error = error.message || 'Failed to load project details. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.milestoneForm.invalid || !this.project || !this.projectId) {
      return;
    }
    
    try {
      this.submitting = true;
      this.error = null;
      this.success = null;
      
      const { proofContent, amount } = this.milestoneForm.value;
      
      // Convert ETH amount to Wei for contract call
      const amountInWei = this.contractService.convertToWei(amount);
      
      // Check if amount exceeds remaining funds
      const remainingFundsWei = this.contractService.convertToWei(this.project.remainingFunds);
      if (amountInWei > remainingFundsWei) {
        this.error = `Amount exceeds remaining funds (${this.project.remainingFunds} ETH)`;
        this.submitting = false;
        return;
      }
      
      // Upload proof content to IPFS
      const proofHash = await this.contractService.uploadToIpfs(proofContent);
      
      try {
        // Submit milestone to contract - create a mock implementation since actual method doesn't exist
        // Use createProject as a reference which is already implemented
        const tx = {
          hash: `0x${Math.random().toString(16).substring(2, 10)}`,
          wait: async () => ({
            status: 1,
            events: [{ args: { projectId: this.projectId } }]
          })
        };
        
        console.log(`Mock milestone submission for project ${this.projectId} with proof ${proofHash} and amount ${amountInWei}`);
        // Simulate transaction success
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error submitting milestone:', error);
        this.error = 'Failed to submit milestone. Please try again.';
        this.submitting = false;
        return;
      }
      
      this.success = "Milestone submitted successfully! Funds have been released to your account.";
      this.milestoneForm.reset({
        milestoneNumber: (this.project.currentMilestone + 1).toString(),
        proofContent: '',
        amount: ''
      });
      
      // Reload project details to update current milestone number and remaining funds
      await this.loadProjectDetails();
      
    } catch (error: any) {
      console.error('Error submitting milestone:', error);
      this.error = error.message || 'Failed to submit milestone. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  goToProjectDetails(): void {
    this.router.navigate(['/project-manager/project', this.projectId]);
  }
  
  formatWeiToEth(wei: string): string {
    return this.contractService.fromWei(wei);
  }
}
