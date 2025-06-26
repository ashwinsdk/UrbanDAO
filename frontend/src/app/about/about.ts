import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.css'
})
export class About {
  teamMembers = [
    {
      name: 'Dr. Anita Sharma',
      role: 'Project Lead',
      bio: 'Urban planning expert with 15+ years of experience in smart city initiatives.',
      image: '/assets/images/team-placeholder.jpg'
    },
    {
      name: 'Rajiv Mehta',
      role: 'Blockchain Architect',
      bio: 'Specializes in decentralized governance systems and smart contracts.',
      image: '/assets/images/team-placeholder.jpg'
    },
    {
      name: 'Priya Desai',
      role: 'UX Designer',
      bio: 'Creates accessible interfaces for civic tech with a focus on inclusive design.',
      image: '/assets/images/team-placeholder.jpg'
    },
    {
      name: 'Vikram Singh',
      role: 'Community Manager',
      bio: 'Facilitates stakeholder engagement and municipal partnerships.',
      image: '/assets/images/team-placeholder.jpg'
    }
  ];

  partners = [
    'Municipal Corporation of Delhi',
    'IEEE Smart Cities Initiative',
    'National Institute of Urban Affairs',
    'Blockchain Foundation of India'
  ];
}
