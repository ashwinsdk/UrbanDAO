import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ValidatorRoutingModule } from './validator-routing.module';
import { ValidatorDashboardComponent } from './pages/dashboard/validator-dashboard.component';
import { GrievanceReviewComponent } from './pages/grievance-review/grievance-review.component';
import { PendingGrievancesComponent } from './pages/pending-grievances/pending-grievances.component';
import { ProcessedGrievancesComponent } from './pages/processed-grievances/processed-grievances.component';

@NgModule({
  declarations: [
    // No components to declare - all are standalone now
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    ValidatorRoutingModule,
    // Import standalone components
    ValidatorDashboardComponent,
    GrievanceReviewComponent,
    PendingGrievancesComponent,
    ProcessedGrievancesComponent
  ]
})
export class ValidatorModule { }
