import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

import { UserRole } from '../models/role.model';

type RoleHierarchyMap = {
  [key: string]: string[];
};

/**
 * Role hierarchy system where higher roles can access lower role features
 * OWNER_ROLE can access everything
 * ADMIN_GOVT_ROLE can access ADMIN_HEAD_ROLE and below
 * etc.
 */
const roleHierarchy: RoleHierarchyMap = {
  'OWNER_ROLE': ['ADMIN_GOVT_ROLE', 'ADMIN_HEAD_ROLE', 'PROJECT_MANAGER_ROLE', 'TAX_COLLECTOR_ROLE', 'VALIDATOR_ROLE', 'CITIZEN_ROLE'],
  'ADMIN_GOVT_ROLE': ['ADMIN_HEAD_ROLE', 'PROJECT_MANAGER_ROLE', 'TAX_COLLECTOR_ROLE', 'VALIDATOR_ROLE', 'CITIZEN_ROLE'],
  'ADMIN_HEAD_ROLE': ['PROJECT_MANAGER_ROLE', 'VALIDATOR_ROLE', 'CITIZEN_ROLE'],
  'PROJECT_MANAGER_ROLE': ['CITIZEN_ROLE'],
  'TAX_COLLECTOR_ROLE': ['CITIZEN_ROLE'],
  'VALIDATOR_ROLE': ['CITIZEN_ROLE'],
  'CITIZEN_ROLE': [],
  'TX_PAYER_ROLE': [],
  'NONE': []
};

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
      
      // Special case: OWNER_ROLE has access to everything
      if (user.role === 'OWNER_ROLE') {
        return true;
      }
      
      // Check if user's role directly matches required role
      const hasRequiredRole = requiredRoles.includes(user.role);
      
      // Check if user's role can access the required role via hierarchy
      const canAccessViaHierarchy = roleHierarchy[user.role]?.some((accessibleRole: string) => 
        requiredRoles.includes(accessibleRole)
      ) || false;
      
      if (hasRequiredRole || canAccessViaHierarchy) {
        return true;
      }
      
      // User doesn't have the required role or hierarchy access
      console.log(`Access denied: Required roles ${requiredRoles}, user role: ${user.role}`);
      router.navigate(['/']);
      return false;
    })
  );
};

