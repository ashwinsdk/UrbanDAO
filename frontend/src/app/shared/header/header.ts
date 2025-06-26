import { Component, OnInit, Renderer2, Inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { UserRole } from '../../auth/user-role.enum';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header implements OnInit, OnDestroy {
  isLoggedIn = false;
  userRole: UserRole | null = null;
  UserRole = UserRole; // Expose enum to template
  isMobileMenuOpen = false;
  publicKey: string | null = null;
  private subscriptions: Subscription[] = [];
  
  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    // Subscribe to auth service observables
    this.subscriptions.push(
      this.authService.connected$.subscribe(connected => {
        this.isLoggedIn = connected;
      })
    );
    
    this.subscriptions.push(
      this.authService.userRole$.subscribe(role => {
        this.userRole = role;
      })
    );
    
    this.subscriptions.push(
      this.authService.publicKey$.subscribe(publicKey => {
        this.publicKey = publicKey;
      })
    );
    
    // Close mobile menu when clicking outside
    this.renderer.listen('window', 'click', (e: Event) => {
      if (this.isMobileMenuOpen) {
        const target = e.target as HTMLElement;
        const navMenu = this.document.getElementById('navMenu');
        const mobileToggle = this.document.querySelector('.mobile-toggle');
        
        if (navMenu && mobileToggle && 
            !navMenu.contains(target) && 
            !mobileToggle.contains(target)) {
          this.closeMobileMenu();
        }
      }
    });
  }
  
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    const navMenu = this.document.getElementById('navMenu');
    
    if (navMenu) {
      if (this.isMobileMenuOpen) {
        this.renderer.addClass(navMenu, 'active');
        this.renderer.addClass(this.document.body, 'menu-open');
      } else {
        this.closeMobileMenu();
      }
    }
  }
  
  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    const navMenu = this.document.getElementById('navMenu');
    
    if (navMenu) {
      this.renderer.removeClass(navMenu, 'active');
      this.renderer.removeClass(this.document.body, 'menu-open');
    }
  }
  
  logout(): void {
    this.authService.logout();
    this.closeMobileMenu();
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
