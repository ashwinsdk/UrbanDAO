import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/role.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container">
      <!-- Public landing page view -->
      <ng-container *ngIf="!isLoggedIn; else dashboardView">
        <section class="hero">
          <h1>Welcome to <span class="gradient-text">UrbanDAO</span></h1>
          <p class="subtitle">A decentralized platform for urban governance, citizen participation, and transparent city management</p>
          <div class="hero-actions">
            <button class="btn btn-primary" (click)="connect()">Connect Wallet</button>
            <a routerLink="/about" class="btn btn-secondary">Learn More</a>
          </div>
        </section>
        
        <section class="features">
          <h2>Core <span class="gradient-text">Features</span></h2>
          <div class="cards">
            <div class="card">
              <h3>Grievance Management</h3>
              <p>File and track urban issues with transparent resolution processes</p>
            </div>
            <div class="card">
              <h3>Tax Management</h3>
              <p>Streamlined tax payments with digital receipts and verifiable records</p>
            </div>
            <div class="card">
              <h3>Project Oversight</h3>
              <p>Monitor city projects, budgets, and progress with full transparency</p>
            </div>
          </div>
        </section>
        
        <section class="roles">
          <h2>Role-Based <span class="gradient-text">System</span></h2>
          <div class="cards">
            <div class="card">
              <h3>Citizens</h3>
              <p>File grievances, make tax payments, and vote on proposals</p>
            </div>
            <div class="card">
              <h3>Validators</h3>
              <p>Verify citizen identities and validate grievances</p>
            </div>
            <div class="card">
              <h3>Tax Collectors</h3>
              <p>Manage tax assessments and collections with full transparency</p>
            </div>
            <div class="card">
              <h3>Project Managers</h3>
              <p>Oversee urban development projects and milestone tracking</p>
            </div>
            <div class="card">
              <h3>Administrators</h3>
              <p>Manage urban areas, assign roles, and resolve escalated issues</p>
            </div>
          </div>
        </section>
      </ng-container>
      
      <!-- Role-based dashboard view -->
      <ng-template #dashboardView>
        <div class="dashboard">
          <header class="dashboard-header">
            <h1>{{ getDashboardTitle() }}</h1>
            <!-- 
            <p *ngIf="userAddress" class="wallet-address">
              Connected: <span class="address">{{ truncateAddress(userAddress) }}</span>
            </p>
            -->
          </header>
          
          <!-- Role-specific dashboard content -->
          <div class="dashboard-content">
            <ng-container [ngSwitch]="userRole">
              <!-- Citizen Dashboard -->
              <ng-container *ngSwitchCase="'CITIZEN_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/citizen/grievances">
                    <h3>My Grievances</h3>
                    <p>File and track your grievances</p>
                  </div>
                  <div class="dashboard-card" routerLink="/citizen/taxes">
                    <h3>Tax Management</h3>
                    <p>View and pay your tax assessments</p>
                  </div>
                  <div class="dashboard-card" routerLink="/citizen/projects">
                    <h3>Local Projects</h3>
                    <p>View ongoing projects in your area</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Validator Dashboard -->
              <ng-container *ngSwitchCase="'VALIDATOR_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/validator/grievances">
                    <h3>Pending Grievances</h3>
                    <p>Validate citizen grievances</p>
                  </div>
                  <div class="dashboard-card" routerLink="/validator/citizens">
                    <h3>Citizen Verification</h3>
                    <p>Verify new citizen registrations</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Tax Collector Dashboard -->
              <ng-container *ngSwitchCase="'TAX_COLLECTOR_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/tax-collector/assessments">
                    <h3>Tax Assessments</h3>
                    <p>Create and manage tax assessments</p>
                  </div>
                  <div class="dashboard-card" routerLink="/tax-collector/collections">
                    <h3>Collections</h3>
                    <p>Track tax payments and receipts</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Project Manager Dashboard -->
              <ng-container *ngSwitchCase="'PROJECT_MANAGER_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/project-manager/projects">
                    <h3>My Projects</h3>
                    <p>Manage your assigned projects</p>
                  </div>
                  <div class="dashboard-card" routerLink="/project-manager/proposals">
                    <h3>Proposals</h3>
                    <p>Review new project proposals</p>
                  </div>
                  <div class="dashboard-card" routerLink="/project-manager/milestones">
                    <h3>Milestones</h3>
                    <p>Track project milestones and funding</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Admin Head Dashboard -->
              <ng-container *ngSwitchCase="'ADMIN_HEAD_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/admin-head/grievances">
                    <h3>Grievance Management</h3>
                    <p>Oversee and resolve grievances</p>
                  </div>
                  <div class="dashboard-card" routerLink="/admin-head/projects">
                    <h3>Project Allocation</h3>
                    <p>Assign projects and allocate budgets</p>
                  </div>
                  <div class="dashboard-card" routerLink="/admin-head/validators">
                    <h3>Validator Management</h3>
                    <p>Assign and manage validators</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Admin Govt Dashboard -->
              <ng-container *ngSwitchCase="'ADMIN_GOVT_ROLE'">
                <div class="dashboard-cards">
                  <div class="dashboard-card" routerLink="/admin-govt/areas">
                    <h3>Area Management</h3>
                    <p>Create and manage urban areas</p>
                  </div>
                  <div class="dashboard-card" routerLink="/admin-govt/roles">
                    <h3>Role Assignment</h3>
                    <p>Assign roles to verified accounts</p>
                  </div>
                  <div class="dashboard-card" routerLink="/admin-govt/treasury">
                    <h3>Treasury</h3>
                    <p>Manage DAO treasury and funds</p>
                  </div>
                </div>
              </ng-container>
              
              <!-- Default Dashboard (No Role) -->
              <ng-container *ngSwitchDefault>
                <div class="no-role">
                  <h2>No Role Assigned</h2>
                  <p>Your account does not have any assigned roles. If you recently registered, please wait for approval.</p>
                  <button class="btn btn-primary" routerLink="/registration-status">Check Registration Status</button>
                </div>
              </ng-container>
            </ng-container>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  isLoggedIn = false;
  userRole: UserRole | null = null;
  userAddress: string | null = null;
  
  constructor(private authService: AuthService, private router: Router) {}
  
  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user?.isLoggedIn;
      this.userRole = user?.role || null;
      this.userAddress = user?.address || null;

      // If user is logged in with a valid role, redirect to their role-specific dashboard
      if (this.isLoggedIn && this.userRole && this.userRole !== UserRole.NONE) {
        this.redirectToRoleDashboard(this.userRole);
      }
    });
  }
  
  /**
   * Redirects users to their role-specific dashboard
   */
  private redirectToRoleDashboard(role: UserRole): void {
    // Only redirect if we're on the home page to prevent infinite redirects
    if (window.location.pathname === '/') {
      switch(role) {
        case UserRole.CITIZEN_ROLE:
          this.router.navigate(['/citizen']);
          break;
        case UserRole.VALIDATOR_ROLE:
          this.router.navigate(['/validator']);
          break;
        case UserRole.TAX_COLLECTOR_ROLE:
          this.router.navigate(['/tax-collector']);
          break;
        case UserRole.PROJECT_MANAGER_ROLE:
          this.router.navigate(['/project-manager']);
          break;
        case UserRole.ADMIN_HEAD_ROLE:
          this.router.navigate(['/admin-head']);
          break;
        case UserRole.ADMIN_GOVT_ROLE:
          this.router.navigate(['/admin-govt']);
          break;
        case UserRole.OWNER_ROLE:
          // Redirect Owner to admin-govt as there's no dedicated owner module
          this.router.navigate(['/admin-govt']);
          break;
        case UserRole.TX_PAYER_ROLE:
          // TX_PAYER doesn't have its own module, redirect to citizen dashboard
          this.router.navigate(['/citizen']);
          break;
        default:
          // No need to redirect for default case
          break;
      }
    }
  }
  
  getDashboardTitle(): string {
    switch(this.userRole) {
      case UserRole.CITIZEN_ROLE:
        return 'Citizen Dashboard';
      case UserRole.VALIDATOR_ROLE:
        return 'Validator Dashboard';
      case UserRole.TAX_COLLECTOR_ROLE:
        return 'Tax Collector Dashboard';
      case UserRole.PROJECT_MANAGER_ROLE:
        return 'Project Manager Dashboard';
      case UserRole.ADMIN_HEAD_ROLE:
        return 'Admin Head Dashboard';
      case UserRole.ADMIN_GOVT_ROLE:
        return 'Government Admin Dashboard';
      case UserRole.OWNER_ROLE:
        return 'Owner Dashboard';
      default:
        return 'Dashboard';
    }
  }
  
  truncateAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }
  
  async connect(): Promise<void> {
    try {
      await this.authService.login();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  }
}
