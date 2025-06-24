import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { UserRole } from './user-role.enum';

export const authGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const expectedRole = route.data['expectedRole'] as UserRole;

    if (!authService.isConnected()) {
        console.log('AuthGuard: Blocked - Wallet not connected.');
        return of(router.createUrlTree(['/login']));
    }

    return authService.userRole$.pipe(
        take(1), // Take the latest value and complete
        map(currentRole => {
            if (currentRole === expectedRole) {
                console.log(`AuthGuard: Allowed - Role '${currentRole}' matches expected '${expectedRole}'.`);
                return true;
            } else {
                console.log(`AuthGuard: Blocked - Role mismatch. Has '${currentRole}', needs '${expectedRole}'.`);
                // Optional: you could show a "403 Forbidden" page here instead
                return router.createUrlTree(['/login']);
            }
        })
    );
};
// NOTE: You'll need to import `of` from `rxjs` for the real implementation. 