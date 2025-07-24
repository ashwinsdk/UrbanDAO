import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Template properties
  title = 'UrbanDAO';
  currentTime = new Date();
  isMobile = false;
  isAuthenticated = false;
  showHeaderFooter = false;
  showMobileNav = false;

  constructor() {
    console.log('🚀 UrbanDAO App component initialized with routing');
    console.log('🚀 App component properties initialized');
    
    // Update current time every second for demo
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }
}
