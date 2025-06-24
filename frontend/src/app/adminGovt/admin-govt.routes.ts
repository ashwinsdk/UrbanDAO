import { Routes } from '@angular/router';

// Component Imports
import { AssignHead } from './assign-head/assign-head';
import { GovtHome } from './govt-home/govt-home';
import { SetTax } from './set-tax/set-tax';
import { ViewGrievance } from './view-grievance/view-grievance';
import { ViewProject } from './view-project/view-project';

export const ADMIN_GOVT_ROUTES: Routes = [
    {
        path: '',
        component: GovtHome,
        title: 'Government Dashboard',
    },
    {
        path: 'assign-head',
        component: AssignHead,
        title: 'Assign Department Head',
    },
    {
        path: 'set-tax',
        component: SetTax,
        title: 'Set Property Tax',
    },
    {
        path: 'view-grievances',
        component: ViewGrievance,
        title: 'View Grievances',
    },
    {
        path: 'view-projects',
        component: ViewProject,
        title: 'View Projects',
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
]; 