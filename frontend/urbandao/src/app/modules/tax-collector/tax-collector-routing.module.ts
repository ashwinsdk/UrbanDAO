import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TaxDashboardComponent } from './pages/dashboard/tax-dashboard.component';
import { TaxAssessmentComponent } from './pages/assessment/tax-assessment.component';
import { TaxPaymentsComponent } from './pages/payments/tax-payments.component';
import { TaxpayerDetailsComponent } from './pages/taxpayer-details/taxpayer-details.component';

const routes: Routes = [
  {
    path: '',
    component: TaxDashboardComponent
  },
  {
    path: 'assessment',
    component: TaxAssessmentComponent
  },
  {
    path: 'payments',
    component: TaxPaymentsComponent
  },
  {
    path: 'taxpayer/:address',
    component: TaxpayerDetailsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TaxCollectorRoutingModule { }
