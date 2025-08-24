import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ValidatorDashboardComponent } from './pages/dashboard/validator-dashboard.component';
import { GrievanceReviewComponent } from './pages/grievance-review/grievance-review.component';
import { PendingGrievancesComponent } from './pages/pending-grievances/pending-grievances.component';
import { ProcessedGrievancesComponent } from './pages/processed-grievances/processed-grievances.component';
import { CitizenVerificationComponent } from './pages/citizen-verification/citizen-verification.component';

const routes: Routes = [
  {
    path: '',
    component: ValidatorDashboardComponent
  },
  {
    path: 'citizen-verification',
    component: CitizenVerificationComponent
  },
  {
    path: 'grievances/pending',
    component: PendingGrievancesComponent
  },
  {
    path: 'grievances/processed',
    component: ProcessedGrievancesComponent
  },
  {
    path: 'grievances/review/:id',
    component: GrievanceReviewComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ValidatorRoutingModule { }
