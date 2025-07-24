import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-test-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; background: lightblue; margin: 20px;">
      <h1>🎉 TEST HOME COMPONENT WORKING!</h1>
      <p>If you can see this, Angular routing is working properly.</p>
      <p>Current time: {{ currentTime }}</p>
    </div>
  `
})
export class TestHome {
  currentTime = new Date().toLocaleString();
  
  constructor() {
    console.log('🧪 TestHome component constructor called');
    console.log('🧪 TestHome component initialized successfully');
  }
}
