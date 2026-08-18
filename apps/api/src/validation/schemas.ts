import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function parseUtcDate(value: string): Date | null {
  if (!dateRegex.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export const credentialsSchema = z.object({
  email: z
    .string({ required_error: 'email is required.' })
    .email('email must be a valid email address.')
    .max(254, 'email must not exceed 254 characters.')
    .transform((value) => value.trim().toLowerCase()),
  password: z
    .string({ required_error: 'password is required.' })
    .min(8, 'password must be at least 8 characters.')
    .max(200, 'password must not exceed 200 characters.'),
});

export const idParamSchema = z.object({
  id: z.string({ required_error: 'id is required.' }).uuid('Document ID must be a valid UUID.'),
});

const lineItemSchema = z.object({
  description: z
    .string({ required_error: 'description is required.' })
    .trim()
    .min(1, 'description cannot be empty.')
    .max(500, 'description must not exceed 500 characters.'),
  quantity: z
    .number({ required_error: 'quantity is required.' })
    .int('quantity must be an integer.')
    .min(1, 'quantity must be at least 1.')
    .max(1_000_000, 'quantity cannot exceed 1,000,000.'),
  unitPrice: z
    .string({ required_error: 'unitPrice is required.' })
    .max(50, 'unitPrice is too long.'),
  discount: z
    .object({
      fixed: z.string().max(50, 'fixed discount is too long.').optional(),
      percentage: z.string().max(50, 'percentage discount is too long.').optional(),
    })
    .optional(),
  taxRate: z.string().max(50, 'taxRate is too long.').optional(),
});

export const documentSchema = z.object({
  title: z
    .string({ required_error: 'title is required.' })
    .trim()
    .min(1, 'title cannot be empty.')
    .max(200, 'title must not exceed 200 characters.'),
  customer: z
    .string({ required_error: 'customer is required.' })
    .trim()
    .min(1, 'customer cannot be empty.')
    .max(200, 'customer must not exceed 200 characters.'),
  issueDate: z
    .string({ required_error: 'issueDate is required.' })
    .refine((val) => parseUtcDate(val) !== null, 'issueDate must be a valid YYYY-MM-DD date.')
    .transform((val) => parseUtcDate(val)!),
  lineItems: z
    .array(lineItemSchema, { required_error: 'lineItems is required.' })
    .min(1, 'Document must contain at least one line item.')
    .max(500, 'Document cannot exceed 500 line items.'),
});

export const reportQuerySchema = z
  .object({
    startDate: z
      .string({ required_error: 'startDate is required.' })
      .refine((val) => parseUtcDate(val) !== null, 'startDate must be a valid YYYY-MM-DD date.'),
    endDate: z
      .string({ required_error: 'endDate is required.' })
      .refine((val) => parseUtcDate(val) !== null, 'endDate must be a valid YYYY-MM-DD date.'),
  })
  .refine(
    (data) => {
      const start = parseUtcDate(data.startDate);
      const end = parseUtcDate(data.endDate);
      if (!start || !end) return true;
      return start.getTime() <= end.getTime();
    },
    {
      message: 'startDate must be before or equal to endDate.',
      path: ['startDate'],
    },
  );
