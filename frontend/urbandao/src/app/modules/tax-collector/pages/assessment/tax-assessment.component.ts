import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ContractService } from '../../../../core/services/contract.service';
import { AuthService } from '../../../../core/services/auth.service';

interface Citizen {
  address: string;
  name?: string;
  propertyId?: string;
  location?: string;
}

@Component({
  selector: 'app-tax-assessment',
  templateUrl: './tax-assessment.component.html',
  styleUrls: ['./tax-assessment.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule]
})
export class TaxAssessmentComponent implements OnInit {
  userAddress: string | null = null;
  assessmentForm: FormGroup;
  
  citizens: Citizen[] = [];
  filteredCitizens: Citizen[] = [];
  searchQuery: string = '';
  
  showCitizensList: boolean = false;
  selectedCitizen: Citizen | null = null;
  
  currentYear = new Date().getFullYear();
  currentQuarter = Math.floor((new Date().getMonth() / 3)) + 1;
  
  loading = false;
  citizensLoading = false;
  submitting = false;
  success = false;
  error: string | null = null;
  
  constructor(
    private fb: FormBuilder,
    private contractService: ContractService,
    private authService: AuthService,
    private router: Router
  ) {
    this.assessmentForm = this.fb.group({
      citizenAddress: ['', [Validators.required]],
      propertyId: ['', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.001)]],
      year: [this.currentYear, [Validators.required]],
      quarter: [this.currentQuarter, [Validators.required]],
      dueDate: ['', [Validators.required]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      lateFee: ['0', [Validators.required, Validators.min(0)]],
      penaltyRate: ['0', [Validators.required, Validators.min(0), Validators.max(100)]]
    });
  }

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.userAddress = user.address;
        this.loadCitizens();
      }
    });
    
    // Set min date for due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Set default due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    this.assessmentForm.get('dueDate')?.setValue(this.formatDate(defaultDueDate));
  }

  async loadCitizens(): Promise<void> {
    try {
      this.citizensLoading = true;
      const citizens = await this.contractService.getAllCitizens();
      
      if (citizens) {
        this.citizens = citizens.map(c => ({
          address: c.address,
          name: c.name,
          propertyId: c.propertyId,
          location: c.location
        }));
        
        this.filteredCitizens = [...this.citizens];
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error loading citizens:', error);
      this.error = error.message || 'Failed to load citizens. Please try again.';
    } finally {
      this.citizensLoading = false;
    }
  }
  
  filterCitizens(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCitizens = [...this.citizens];
      return;
    }
    
    const query = this.searchQuery.toLowerCase();
    this.filteredCitizens = this.citizens.filter(citizen => 
      citizen.address.toLowerCase().includes(query) || 
      (citizen.name && citizen.name.toLowerCase().includes(query)) ||
      (citizen.propertyId && citizen.propertyId.toLowerCase().includes(query)) ||
      (citizen.location && citizen.location.toLowerCase().includes(query))
    );
  }
  
  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.filterCitizens();
    this.showCitizensList = true;
  }
  
  selectCitizen(citizen: Citizen): void {
    this.selectedCitizen = citizen;
    this.assessmentForm.patchValue({
      citizenAddress: citizen.address,
      propertyId: citizen.propertyId || ''
    });
    this.showCitizensList = false;
    this.searchQuery = citizen.name || this.formatAddress(citizen.address);
  }
  
  async onSubmit(): Promise<void> {
    if (this.assessmentForm.invalid) return;
    
    const formValues = this.assessmentForm.value;
    
    try {
      this.submitting = true;
      
      // Convert date string to timestamp
      const dueDate = new Date(formValues.dueDate).getTime() / 1000;
      
      const success = await this.contractService.createTaxAssessment({
        citizenAddress: formValues.citizenAddress,
        propertyId: formValues.propertyId,
        amount: formValues.amount,
        year: formValues.year,
        quarter: formValues.quarter,
        dueDate,
        description: formValues.description,
        lateFee: formValues.lateFee,
        penaltyRate: formValues.penaltyRate
      });
      
      if (success) {
        this.success = true;
        setTimeout(() => {
          this.router.navigate(['/tax-collector/']);
        }, 2000);
      }
      
      this.error = null;
    } catch (error: any) {
      console.error('Error creating tax assessment:', error);
      this.error = error.message || 'Failed to create tax assessment. Please try again.';
      this.success = false;
    } finally {
      this.submitting = false;
    }
  }
  
  resetForm(): void {
    this.assessmentForm.reset({
      year: this.currentYear,
      quarter: this.currentQuarter,
      lateFee: '0',
      penaltyRate: '0'
    });
    
    // Reset due date to 30 days from now
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 30);
    this.assessmentForm.get('dueDate')?.setValue(this.formatDate(defaultDueDate));
    
    this.selectedCitizen = null;
    this.searchQuery = '';
    this.error = null;
    this.success = false;
  }
  
  formatAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
