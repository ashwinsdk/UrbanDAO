import { Routes } from '@angular/router';

// Component Imports
import { Feedback } from './feedback/feedback';
import { FileGrievance } from './file-grievance/file-grievance';
import { PayTax } from './pay-tax/pay-tax';
import { Status } from './status/status';
import { UserHome } from './user-home/user-home';
import { ViewProjects } from './view-projects/view-projects';

export const USER_ROUTES: Routes = [
    {
        path: '',
        component: UserHome,
        title: 'Your Dashboard',
    },
    {
        path: 'feedback',
        component: Feedback,
        title: 'Submit Feedback',
    },
    {
        path: 'file-grievance',
        component: FileGrievance,
        title: 'File a Grievance',
    },
    {
        path: 'pay-tax',
        component: PayTax,
        title: 'Pay Property Tax',
    },
    {
        path: 'status',
        component: Status,
        title: 'Check Grievance Status',
    },
    {
        path: 'view-projects',
        component: ViewProjects,
        title: 'View Municipal Projects',
    },
    {
        path: '**',
        redirectTo: '',
        pathMatch: 'full',
    },
]; 