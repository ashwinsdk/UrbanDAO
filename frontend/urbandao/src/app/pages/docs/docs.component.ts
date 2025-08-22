import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-docs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="docs-container">
      <h1>UrbanDAO Documentation</h1>
      
      <div class="docs-section">
        <h2>Overview</h2>
        <p>
          UrbanDAO is a blockchain-powered smart-city management platform for urban governance. 
          This documentation provides information on how to interact with the platform.
        </p>
      </div>
      
      <div class="docs-section">
        <h2>Smart Contracts</h2>
        <h3>Core Contracts</h3>
        <ul>
          <li><strong>UrbanCore.sol</strong>: Central orchestrator contract implementing UUPS upgradeability pattern</li>
          <li><strong>UrbanToken.sol</strong>: ERC-20 governance token with advanced features</li>
          <li><strong>UrbanGovernor.sol</strong>: Governance system with timelock</li>
        </ul>
        
        <h3>Functional Modules</h3>
        <ul>
          <li><strong>GrievanceHub.sol</strong>: Manages citizen grievances</li>
          <li><strong>TaxModule.sol</strong>: Handles tax assessments and payments</li>
          <li><strong>ProjectRegistry.sol</strong>: Project management system</li>
          <li><strong>TaxReceipt.sol</strong>: Soul-bound NFT receipt system</li>
        </ul>
      </div>
      
      <div class="docs-section">
        <h2>User Roles</h2>
        <p>UrbanDAO implements a role-based access control system with the following roles:</p>
        <ul>
          <li><strong>Citizen</strong>: Regular users who can file grievances and pay taxes</li>
          <li><strong>Validator</strong>: Validates grievances filed by citizens</li>
          <li><strong>Tax Collector</strong>: Manages tax assessments and collections</li>
          <li><strong>Project Manager</strong>: Oversees urban development projects</li>
          <li><strong>Admin Head</strong>: Administrative head with advanced permissions</li>
          <li><strong>Admin Govt</strong>: Government administrative role with highest permissions</li>
        </ul>
      </div>
      
      <div class="docs-section">
        <h2>APIs and Integration</h2>
        <p>
          Documentation for API integration will be available soon.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .docs-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .docs-section {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    
    h1 {
      color: #a259d9;
      margin-bottom: 2rem;
      font-size: 2.5rem;
    }
    
    h2 {
      color: #333;
      margin-bottom: 1rem;
      border-bottom: 2px solid #a259d9;
      padding-bottom: 0.5rem;
    }
    
    h3 {
      color: #444;
      margin: 1.5rem 0 1rem;
    }
    
    ul {
      padding-left: 2rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    strong {
      color: #a259d9;
    }
  `]
})
export class DocsComponent {
  // Component logic here
}
