import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditGrievance } from './edit-grievance';

describe('EditGrievance', () => {
  let component: EditGrievance;
  let fixture: ComponentFixture<EditGrievance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditGrievance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditGrievance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
