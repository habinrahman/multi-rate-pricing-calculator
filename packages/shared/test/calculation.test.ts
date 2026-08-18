import { describe, expect, it } from 'vitest';
import {
  CalculationError,
  calculateDocumentTotals,
  calculateLineItem,
  formatMoney,
  parseMoney,
  parsePercentage,
} from '../src/index.js';

const widgetA = {
  description: 'Widget A',
  quantity: 2,
  unitPrice: '100.00',
  discount: { percentage: '10' },
  taxRate: '5',
};
const widgetB = { description: 'Widget B', quantity: 1, unitPrice: '50.00', taxRate: '5' };
const serviceFee = {
  description: 'Service fee',
  quantity: 1,
  unitPrice: '200.00',
  discount: { fixed: '20.00' },
  taxRate: '0',
};

describe('calculation engine', () => {
  it('calculates Widget A with percentage discount before tax', () => {
    expect(calculateLineItem(widgetA)).toMatchObject({
      subtotalCents: 20000,
      discount: { type: 'percentage', amountCents: 2000 },
      discountedAmountCents: 18000,
      taxCents: 900,
      totalCents: 18900,
    });
  });

  it('calculates Widget B without discount', () => {
    expect(calculateLineItem(widgetB)).toMatchObject({
      subtotalCents: 5000,
      discount: { type: 'none', amountCents: 0 },
      taxCents: 250,
      totalCents: 5250,
    });
  });

  it('calculates service fee with a fixed discount', () => {
    expect(calculateLineItem(serviceFee)).toMatchObject({
      subtotalCents: 20000,
      discount: { type: 'fixed', amountCents: 2000 },
      discountedAmountCents: 18000,
      taxCents: 0,
      totalCents: 18000,
    });
  });

  it('calculates the mandatory sample document totals', () => {
    const totals = calculateDocumentTotals([
      calculateLineItem(widgetA),
      calculateLineItem(widgetB),
      calculateLineItem(serviceFee),
    ]);
    expect(totals).toEqual({
      subtotalCents: 45000,
      totalDiscountCents: 4000,
      totalTaxCents: 1150,
      grandTotalCents: 42150,
    });
    expect(
      Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, formatMoney(value)])),
    ).toEqual({
      subtotalCents: '450.00',
      totalDiscountCents: '40.00',
      totalTaxCents: '11.50',
      grandTotalCents: '421.50',
    });
  });

  it('handles zero-value and decimal inputs', () => {
    expect(
      calculateLineItem({
        quantity: 1,
        unitPrice: '0.00',
        discount: { fixed: '0.00' },
        taxRate: '0.00',
      }),
    ).toMatchObject({ subtotalCents: 0, totalCents: 0 });
    expect(calculateLineItem({ quantity: 3, unitPrice: '0.10', taxRate: '0' }).totalCents).toBe(30);
    expect(parseMoney('10.01')).toBe(1001);
  });

  it('rounds each percentage calculation half-up at line boundaries', () => {
    expect(
      calculateLineItem({
        quantity: 1,
        unitPrice: '0.01',
        discount: { percentage: '50' },
        taxRate: '0',
      }).discount.amountCents,
    ).toBe(1);
    expect(calculateLineItem({ quantity: 1, unitPrice: '0.01', taxRate: '50' }).taxCents).toBe(1);
  });

  it('sums independently calculated multiple lines without re-rounding', () => {
    const lines = [
      calculateLineItem({ quantity: 1, unitPrice: '0.01', taxRate: '50' }),
      calculateLineItem({ quantity: 1, unitPrice: '0.01', taxRate: '50' }),
    ];
    expect(calculateDocumentTotals(lines)).toMatchObject({
      subtotalCents: 2,
      totalTaxCents: 2,
      grandTotalCents: 4,
    });
  });

  describe('adversarial boundary & attack vectors', () => {
    it('handles 100% discount cleanly (exact zero balance, 0 tax, 0 total)', () => {
      const line = calculateLineItem({
        quantity: 5,
        unitPrice: '40.00',
        discount: { percentage: '100' },
        taxRate: '10',
      });
      expect(line.subtotalCents).toBe(20000);
      expect(line.discount.amountCents).toBe(20000);
      expect(line.discountedAmountCents).toBe(0);
      expect(line.taxCents).toBe(0);
      expect(line.totalCents).toBe(0);
    });

    it('handles fixed discount exactly equal to subtotal cleanly', () => {
      const line = calculateLineItem({
        quantity: 2,
        unitPrice: '50.00',
        discount: { fixed: '100.00' },
        taxRate: '8.25',
      });
      expect(line.subtotalCents).toBe(10000);
      expect(line.discount.amountCents).toBe(10000);
      expect(line.discountedAmountCents).toBe(0);
      expect(line.taxCents).toBe(0);
      expect(line.totalCents).toBe(0);
    });

    it('proves absence of floating-point drift on critical decimal currency amounts', () => {
      // 0.1 + 0.2 = 0.30 (not 0.30000000000000004)
      const l1 = calculateLineItem({ quantity: 1, unitPrice: '0.10' });
      const l2 = calculateLineItem({ quantity: 1, unitPrice: '0.20' });
      const l3 = calculateLineItem({ quantity: 1, unitPrice: '0.29' });
      const l4 = calculateLineItem({ quantity: 1, unitPrice: '0.99' });
      const l5 = calculateLineItem({ quantity: 1, unitPrice: '999.99' });
      const l6 = calculateLineItem({ quantity: 1, unitPrice: '1000000.01' });

      expect(l1.subtotalCents).toBe(10);
      expect(l2.subtotalCents).toBe(20);
      expect(l3.subtotalCents).toBe(29);
      expect(l4.subtotalCents).toBe(99);
      expect(l5.subtotalCents).toBe(99999);
      expect(l6.subtotalCents).toBe(100000001);

      const totals = calculateDocumentTotals([l1, l2, l3, l4, l5, l6]);
      expect(totals.grandTotalCents).toBe(10 + 20 + 29 + 99 + 99999 + 100000001);
      expect(formatMoney(totals.grandTotalCents)).toBe('1001001.58');
    });

    it('rejects invalid percentage inputs with parsePercentage', () => {
      expect(() => parsePercentage('100.01', 'taxRate')).toThrowError(CalculationError);
      expect(() => parsePercentage('-1', 'taxRate')).toThrowError(CalculationError);
      expect(() => parsePercentage('abc', 'taxRate')).toThrowError(CalculationError);
    });

    it.each([
      [{ quantity: -1, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: 0, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: 1.5, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: NaN, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: Infinity, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: 1_000_001, unitPrice: '10.00' }, 'INVALID_QUANTITY'],
      [{ quantity: 1, unitPrice: '-1.00' }, 'INVALID_MONEY'],
      [{ quantity: 1, unitPrice: '10.999' }, 'INVALID_MONEY'],
      [{ quantity: 1, unitPrice: 'abc' }, 'INVALID_MONEY'],
      [{ quantity: 1, unitPrice: '' }, 'INVALID_MONEY'],
      [{ quantity: 1, unitPrice: '1.00', taxRate: '-5' }, 'INVALID_PERCENTAGE'],
      [{ quantity: 1, unitPrice: '1.00', taxRate: '100.01' }, 'INVALID_PERCENTAGE'],
      [{ quantity: 1, unitPrice: '1.00', taxRate: '150' }, 'INVALID_PERCENTAGE'],
      [
        { quantity: 1, unitPrice: '1.00', discount: { percentage: '100.01' } },
        'INVALID_PERCENTAGE',
      ],
      [{ quantity: 1, unitPrice: '1.00', discount: { percentage: '-10' } }, 'INVALID_PERCENTAGE'],
      [{ quantity: 1, unitPrice: '1.00', discount: { fixed: '-5.00' } }, 'INVALID_MONEY'],
      [
        { quantity: 1, unitPrice: '10.00', discount: { fixed: '10.01' } },
        'FIXED_DISCOUNT_EXCEEDS_SUBTOTAL',
      ],
      [
        { quantity: 1, unitPrice: '1.00', discount: { fixed: '0.10', percentage: '10' } },
        'CONFLICTING_DISCOUNTS',
      ],
    ])('rejects invalid financial attack vector %#', (input, code) => {
      expect(() => calculateLineItem(input)).toThrow(
        expect.objectContaining<Partial<CalculationError>>({ code }),
      );
    });
  });
});
