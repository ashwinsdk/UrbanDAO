import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const roleGuard = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Get the roles required for the route
  const requiredRoles = route.data['roles'] as Array<string>;
  
  if (!requiredRoles || requiredRoles.length === 0) {
    return true; // No specific roles required
  }
  
  return authService.user$.pipe(
    take(1),
    map(user => {
      // Check if user has the required role
      if (!user?.role) {
        router.navigate(['/']);
        return false;
      }
      
      const hasRequiredRole = requiredRoles.includes(user.role);
      
      if (hasRequiredRole) {
        return true;
      }
      
      // User doesn't have the required role
      console.log(`Access denied: Required roles ${requiredRoles}, user role: ${user.role}`);
      router.navigate(['/']);
      return false;
    })
  );
};
