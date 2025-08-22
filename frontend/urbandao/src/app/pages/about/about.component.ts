import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="about-container">
      <h1>About UrbanDAO</h1>
      
      <section class="about-section">
        <h2>Our Mission</h2>
        <p>
          UrbanDAO is a decentralized autonomous organization focused on revolutionizing urban governance through blockchain technology. 
          Our mission is to create transparent, efficient, and participatory smart city management systems that empower citizens 
          and improve the quality of urban services.
        </p>
      </section>
      
      <section class="about-section">
        <h2>Vision</h2>
        <p>
          We envision a future where cities are managed through transparent blockchain-based systems that enable:
        </p>
        <ul>
          <li>Direct citizen participation in urban governance</li>
          <li>Transparent and efficient tax collection and utilization</li>
          <li>Fair and accessible grievance redressal</li>
          <li>Community-driven urban development projects</li>
          <li>Decentralized decision-making for public resources</li>
        </ul>
      </section>
      
      <section class="about-section">
        <h2>How It Works</h2>
        <p>
          UrbanDAO operates on the Ethereum blockchain using a system of smart contracts that manage different aspects 
          of urban governance:
        </p>
        <div class="feature-grid">
          <div class="feature">
            <h3>Grievance Management</h3>
            <p>Citizens can file grievances that are transparently tracked from submission to resolution.</p>
          </div>
          <div class="feature">
            <h3>Tax System</h3>
            <p>Transparent tax assessment, collection, and utilization with blockchain-verified receipts.</p>
          </div>
          <div class="feature">
            <h3>Project Management</h3>
            <p>Community-driven project proposals, funding, and execution with milestone-based releases.</p>
          </div>
          <div class="feature">
            <h3>Governance</h3>
            <p>Token-based voting system for making key decisions about resource allocation and policies.</p>
          </div>
        </div>
      </section>
      
      <section class="about-section">
        <h2>Technology</h2>
        <p>
          UrbanDAO is built using state-of-the-art blockchain technology:
        </p>
        <ul>
          <li>Ethereum blockchain (Sepolia testnet)</li>
          <li>Solidity smart contracts with OpenZeppelin security</li>
          <li>ERC-2771 meta-transactions for gasless user experience</li>
          <li>Angular frontend with Web3 integration</li>
          <li>IPFS for decentralized document storage</li>
        </ul>
      </section>
    </div>
  `,
  styles: [`
    .about-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      color: #a259d9;
      margin-bottom: 2rem;
      font-size: 2.5rem;
    }
    
    .about-section {
      margin-bottom: 3rem;
    }
    
    h2 {
      color: #333;
      margin-bottom: 1rem;
      border-bottom: 2px solid #a259d9;
      padding-bottom: 0.5rem;
    }
    
    h3 {
      color: #444;
      margin-bottom: 0.75rem;
    }
    
    p {
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    
    ul {
      padding-left: 2rem;
      margin-bottom: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin-top: 1.5rem;
    }
    
    .feature {
      background-color: #f8f9fa;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    .feature h3 {
      color: #a259d9;
    }
    
    .feature p {
      margin-bottom: 0;
    }
  `]
})
export class AboutComponent {
  // Component logic here
}
