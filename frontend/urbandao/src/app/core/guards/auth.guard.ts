import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.user$.pipe(
    take(1),
    map(user => {
      // Check if the user is authenticated
      const isLoggedIn = !!user?.isLoggedIn;
      
      if (isLoggedIn) {
        return true;
      }
      
      // User is not logged in, redirect to login page
      router.navigate(['/login']);
      return false;
    })
  );
};
