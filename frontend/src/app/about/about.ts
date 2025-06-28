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
      name: 'Ashwin Sudhakar',
      role: 'Student, built entire project',
      bio: 'Ashwin Sudhakar is a student and the sole developer of UrbanDAO, responsible for building the entire project.',
      image: '/assets/images/ashwin-dark.png', // Use dark image by default; swap in template for light if needed
      imageLight: '/assets/images/ashwin-light.png',
      imageDark: '/assets/images/ashwin-dark.png'
    }
  ];

  partners = [
    'IEEE CS'
  ];
}
