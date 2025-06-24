import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileGrievance } from './file-grievance';

describe('FileGrievance', () => {
  let component: FileGrievance;
  let fixture: ComponentFixture<FileGrievance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileGrievance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileGrievance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
