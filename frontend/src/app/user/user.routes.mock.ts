import { Routes } from '@angular/router';

// Mock Component Import - NO Solana service dependencies
import { UserHomeMock } from './user-home/user-home-mock';

// TEST USER ROUTES - Using mock components to isolate Solana service errors
export const USER_ROUTES_MOCK: Routes = [
    {
        path: '',
        component: UserHomeMock,
        title: 'Mock User Dashboard - Testing Lazy Loading',
    },
    // Note: Only including the home route for testing
    // Once this works, we know the issue is with Solana service dependencies
];
