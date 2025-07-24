import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-user-home-mock',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="padding: 20px; background: lightgreen; margin: 20px;">
      <h1>🎉 USER HOME MOCK COMPONENT WORKING!</h1>
      <p>This confirms lazy loading works when Solana services are mocked.</p>
      <p>Current time: {{ currentTime }}</p>
      <div style="margin-top: 20px;">
        <h3>Mock User Dashboard</h3>
        <p>✅ Lazy loading successful</p>
        <p>✅ User module imports working</p>
        <p>✅ Component rendering properly</p>
        <p>❌ Real Solana services causing runtime errors</p>
      </div>
    </div>
  `
})
export class UserHomeMock implements OnInit {
  currentTime = new Date().toLocaleString();
  
  constructor() {
    console.log('🧪 UserHomeMock component constructor called');
    console.log('🧪 Mock component - no Solana service dependencies');
  }

  ngOnInit(): void {
    console.log('🧪 UserHomeMock ngOnInit - lazy loading successful');
    
    // Update time every second for demo
    setInterval(() => {
      this.currentTime = new Date().toLocaleString();
    }, 1000);
  }
}
