export type DecimalInput = string;

export interface LineItemInput {
  description?: string | undefined;
  quantity: number;
  unitPrice: DecimalInput;
  discount?:
    { fixed?: DecimalInput | undefined; percentage?: DecimalInput | undefined } | undefined;
  taxRate?: DecimalInput | undefined;
}

export type CalculatedDiscount =
  | { type: 'none'; amountCents: 0 }
  | { type: 'fixed'; amountCents: number }
  | { type: 'percentage'; amountCents: number; rateBasisPoints: number };

export interface CalculatedLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  discount: CalculatedDiscount;
  discountedAmountCents: number;
  taxRateBasisPoints: number;
  taxCents: number;
  totalCents: number;
}

export interface DocumentTotals {
  subtotalCents: number;
  totalDiscountCents: number;
  totalTaxCents: number;
  grandTotalCents: number;
}

export class CalculationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}

const HUNDRED_PERCENT_BASIS_POINTS = 10_000;
const MAX_QUANTITY = 1_000_000;

/** Parses a non-negative decimal currency value into integer cents. */
export function parseMoney(value: DecimalInput, field = 'amount'): number {
  return parseDecimal(value, field, 'INVALID_MONEY');
}

/** Parses a percentage (for example, "8.25") into integer basis points. */
export function parsePercentage(value: DecimalInput, field: string): number {
  const basisPoints = parseDecimal(value, field, 'INVALID_PERCENTAGE');
  if (basisPoints > HUNDRED_PERCENT_BASIS_POINTS) {
    throw new CalculationError('INVALID_PERCENTAGE', `${field} cannot exceed 100%.`);
  }
  return basisPoints;
}

/** Formats integer cents for transport or display at the application boundary. */
export function formatMoney(cents: number): string {
  assertIntegerCents(cents, 'cents');
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/**
 * Calculates a line using integer cents and basis points only.
 * Percentage discount and tax are rounded half-up to cents on each line.
 */
export function calculateLineItem(input: LineItemInput): CalculatedLineItem {
  if (
    !Number.isSafeInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_QUANTITY
  ) {
    throw new CalculationError(
      'INVALID_QUANTITY',
      `quantity must be an integer between 1 and ${MAX_QUANTITY}.`,
    );
  }

  const unitPriceCents = parseMoney(input.unitPrice, 'unitPrice');
  const subtotalCents = multiplyIntegers(
    input.quantity,
    unitPriceCents,
    'Line subtotal is too large.',
  );
  const discount = calculateDiscount(input.discount, subtotalCents);
  const discountedAmountCents = subtractIntegers(
    subtotalCents,
    discount.amountCents,
    'Discount cannot exceed subtotal.',
  );
  const taxRateBasisPoints = parsePercentage(input.taxRate ?? '0', 'taxRate');
  const taxCents = roundPercentage(
    discountedAmountCents,
    taxRateBasisPoints,
    'Tax amount is too large.',
  );

  return {
    description: input.description?.trim() ?? '',
    quantity: input.quantity,
    unitPriceCents,
    subtotalCents,
    discount,
    discountedAmountCents,
    taxRateBasisPoints,
    taxCents,
    totalCents: addIntegers(discountedAmountCents, taxCents, 'Line total is too large.'),
  };
}

/** Sums calculated line values. Lines are already rounded, so totals never re-round them. */
export function calculateDocumentTotals(lines: readonly CalculatedLineItem[]): DocumentTotals {
  return lines.reduce<DocumentTotals>(
    (totals, line) => ({
      subtotalCents: addIntegers(
        totals.subtotalCents,
        line.subtotalCents,
        'Document subtotal is too large.',
      ),
      totalDiscountCents: addIntegers(
        totals.totalDiscountCents,
        line.discount.amountCents,
        'Document discount is too large.',
      ),
      totalTaxCents: addIntegers(totals.totalTaxCents, line.taxCents, 'Document tax is too large.'),
      grandTotalCents: addIntegers(
        totals.grandTotalCents,
        line.totalCents,
        'Document total is too large.',
      ),
    }),
    { subtotalCents: 0, totalDiscountCents: 0, totalTaxCents: 0, grandTotalCents: 0 },
  );
}

function calculateDiscount(
  input: LineItemInput['discount'],
  subtotalCents: number,
): CalculatedDiscount {
  const fixed = input?.fixed;
  const percentage = input?.percentage;
  if (fixed !== undefined && percentage !== undefined) {
    throw new CalculationError('CONFLICTING_DISCOUNTS', 'Only one discount type may be supplied.');
  }
  if (fixed !== undefined) {
    const amountCents = parseMoney(fixed, 'fixedDiscount');
    if (amountCents > subtotalCents)
      throw new CalculationError(
        'FIXED_DISCOUNT_EXCEEDS_SUBTOTAL',
        'Fixed discount cannot exceed subtotal.',
      );
    return { type: 'fixed', amountCents };
  }
  if (percentage !== undefined) {
    const rateBasisPoints = parsePercentage(percentage, 'percentageDiscount');
    return {
      type: 'percentage',
      rateBasisPoints,
      amountCents: roundPercentage(subtotalCents, rateBasisPoints, 'Discount amount is too large.'),
    };
  }
  return { type: 'none', amountCents: 0 };
}

function parseDecimal(value: DecimalInput, field: string, code: string): number {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new CalculationError(
      code,
      `${field} must be a non-negative decimal with at most two decimal places.`,
    );
  }
  const [whole = '0', fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CalculationError(code, `${field} is too large.`);
  return Number(cents);
}

function roundPercentage(cents: number, basisPoints: number, message: string): number {
  const product = multiplyIntegers(cents, basisPoints, message);
  return Math.floor((product + HUNDRED_PERCENT_BASIS_POINTS / 2) / HUNDRED_PERCENT_BASIS_POINTS);
}

function addIntegers(a: number, b: number, message: string): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new CalculationError('AMOUNT_TOO_LARGE', message);
  return result;
}

function subtractIntegers(a: number, b: number, message: string): number {
  const result = a - b;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new CalculationError('FIXED_DISCOUNT_EXCEEDS_SUBTOTAL', message);
  return result;
}

function multiplyIntegers(a: number, b: number, message: string): number {
  const result = a * b;
  if (!Number.isSafeInteger(result)) throw new CalculationError('AMOUNT_TOO_LARGE', message);
  return result;
}

function assertIntegerCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value))
    throw new CalculationError('INVALID_MONEY', `${field} must be safe integer cents.`);
}
