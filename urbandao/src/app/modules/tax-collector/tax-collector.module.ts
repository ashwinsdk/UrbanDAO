import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { TaxCollectorRoutingModule } from './tax-collector-routing.module';
import { TaxDashboardComponent } from './pages/dashboard/tax-dashboard.component';
import { TaxAssessmentComponent } from './pages/assessment/tax-assessment.component';
import { TaxPaymentsComponent } from './pages/payments/tax-payments.component';
import { TaxpayerDetailsComponent } from './pages/taxpayer-details/taxpayer-details.component';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TaxCollectorRoutingModule,
    TaxDashboardComponent,
    TaxAssessmentComponent,
    TaxPaymentsComponent,
    TaxpayerDetailsComponent
  ]
})
export class TaxCollectorModule { }
