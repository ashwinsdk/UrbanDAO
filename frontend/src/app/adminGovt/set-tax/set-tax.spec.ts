import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetTax } from './set-tax';

describe('SetTax', () => {
  let component: SetTax;
  let fixture: ComponentFixture<SetTax>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTax]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetTax);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
