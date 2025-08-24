import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/role.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="header">
      <div class="header-container">
        <div class="logo">
          <a routerLink="/">
            <img src="assets/urbanDOA.png" alt="UrbanDAO Logo" height="40" />
          </a>
        </div>
        
        <nav class="nav">
          <ul class="nav-list">
            <ng-container *ngIf="!isLoggedIn; else loggedInNav">
              <li><a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a></li>
              <li><a routerLink="/about" routerLinkActive="active">About</a></li>
              <li><a class="button" routerLink="/login">Connect Wallet</a></li>
            </ng-container>
            
            <ng-template #loggedInNav>
              <!-- Role-based navigation -->
              <ng-container [ngSwitch]="userRole">
                <!-- Citizen navigation -->
                <ng-container *ngSwitchCase="'CITIZEN_ROLE'">
                  <li><a routerLink="/citizen/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/citizen/grievances" routerLinkActive="active">Grievances</a></li>
                  <li><a routerLink="/citizen/taxes" routerLinkActive="active">Taxes</a></li>
                </ng-container>
                
                <!-- Validator navigation -->
                <ng-container *ngSwitchCase="'VALIDATOR_ROLE'">
                  <li><a routerLink="/validator/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/validator/grievances" routerLinkActive="active">Grievances</a></li>
                </ng-container>
                
                <!-- Tax Collector navigation -->
                <ng-container *ngSwitchCase="'TAX_COLLECTOR_ROLE'">
                  <li><a routerLink="/tax-collector/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/tax-collector/assessments" routerLinkActive="active">Assessments</a></li>
                </ng-container>
                
                <!-- Project Manager navigation -->
                <ng-container *ngSwitchCase="'PROJECT_MANAGER_ROLE'">
                  <li><a routerLink="/project-manager/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/project-manager/projects" routerLinkActive="active">Projects</a></li>
                </ng-container>
                
                <!-- Admin Head navigation -->
                <ng-container *ngSwitchCase="'ADMIN_HEAD_ROLE'">
                  <li><a routerLink="/admin-head/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/admin-head/grievances" routerLinkActive="active">Grievances</a></li>
                  <li><a routerLink="/admin-head/projects" routerLinkActive="active">Projects</a></li>
                </ng-container>
                
                <!-- Admin Govt navigation -->
                <ng-container *ngSwitchCase="'ADMIN_GOVT_ROLE'">
                  <li><a routerLink="/admin-govt/dashboard" routerLinkActive="active">Dashboard</a></li>
                  <li><a routerLink="/admin-govt/areas" routerLinkActive="active">Areas</a></li>
                  <li><a routerLink="/admin-govt/roles" routerLinkActive="active">Roles</a></li>
                </ng-container>
              </ng-container>
              
              <!-- Account and logout -->
              <li>
                <div class="account" *ngIf="userAddress">
                  <span class="address">{{ truncateAddress(userAddress) }}</span>
                </div>
              </li>
              <li><button class="button" (click)="logout()">Disconnect</button></li>
            </ng-template>
          </ul>
        </nav>
      </div>
    </header>
  `,
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  isLoggedIn = false;
  userRole: string | null = null;
  userAddress: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user?.isLoggedIn;
      this.userRole = user?.role || null;
      this.userAddress = user?.address || null;
    });
  }

  truncateAddress(address: string): string {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
  }

  logout(): void {
    this.authService.logout();
  }
}
