import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CITIZEN_ROUTES } from './citizen.routes';

@NgModule({
  imports: [
    RouterModule.forChild(CITIZEN_ROUTES)
  ]
})
export class CitizenModule { }
