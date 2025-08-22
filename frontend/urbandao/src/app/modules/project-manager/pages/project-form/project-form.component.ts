import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ContractService } from '../../../../core/services/contract.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-project-form',
  templateUrl: './project-form.component.html',
  styleUrls: ['./project-form.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule]
})
export class ProjectFormComponent implements OnInit {
  projectForm!: FormGroup;
  loading = false;
  submitting = false;
  error: string | null = null;
  success = false;
  
  constructor(
    private fb: FormBuilder,
    private contractService: ContractService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.projectForm = this.fb.group({
      title: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      location: ['', [Validators.required]],
      budget: ['', [Validators.required, Validators.min(0)]],
      timeline: ['', [Validators.required, Validators.min(1)]],
      documents: ['']
    });
  }

  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid) {
      return;
    }

    this.submitting = true;
    this.error = null;

    try {
      const formData = this.projectForm.value;
      
      // Convert budget to proper format for contract
      const budgetInWei = this.contractService.convertToWei(formData.budget);
      
      // Handle submission to contract
      await this.contractService.createProjectFromData({
        title: formData.title,
        description: formData.description,
        location: formData.location,
        budget: budgetInWei.toString(),
        timelineInDays: formData.timeline,
        documents: formData.documents || ''
      });

      this.success = true;
      setTimeout(() => {
        this.router.navigate(['/project-manager/projects']);
      }, 2000);
    } catch (error: any) {
      console.error('Error creating project:', error);
      this.error = error.message || 'Failed to create project. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/project-manager']);
  }
}
