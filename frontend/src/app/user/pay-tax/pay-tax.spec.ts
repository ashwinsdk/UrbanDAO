import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PayTax } from './pay-tax';

describe('PayTax', () => {
  let component: PayTax;
  let fixture: ComponentFixture<PayTax>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PayTax]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PayTax);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
