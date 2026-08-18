'use client';

import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  calculateDocumentTotals,
  calculateLineItem,
  formatMoney,
  type CalculatedLineItem,
  type LineItemInput,
} from '@multi-rate/shared';

export interface FormLineItem {
  id: string;
  description: string;
  quantity: number | '';
  unitPrice: string;
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: string;
  taxRate: string;
}

interface LineItemsEditorProps {
  items: FormLineItem[];
  onChange: (items: FormLineItem[]) => void;
  disabled?: boolean;
}

export function LineItemsEditor({ items, onChange, disabled = false }: LineItemsEditorProps) {
  const addItem = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: '0.00',
        discountType: 'none',
        discountValue: '',
        taxRate: '0',
      },
    ]);
  };

  const updateItem = (index: number, patch: Partial<FormLineItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch } as FormLineItem;
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  // Compute live preview calculations safely
  const preview = useMemo(() => {
    const calculatedLines: (CalculatedLineItem | null)[] = [];
    const validLines: CalculatedLineItem[] = [];

    for (const item of items) {
      try {
        const qty = typeof item.quantity === 'number' ? item.quantity : 1;
        const lineInput: LineItemInput = {
          description: item.description,
          quantity: qty > 0 ? qty : 1,
          unitPrice: item.unitPrice || '0.00',
          discount:
            item.discountType === 'fixed'
              ? { fixed: item.discountValue || '0.00' }
              : item.discountType === 'percentage'
                ? { percentage: item.discountValue || '0' }
                : undefined,
          taxRate: item.taxRate || '0',
        };

        const calculated = calculateLineItem(lineInput);
        calculatedLines.push(calculated);
        validLines.push(calculated);
      } catch {
        calculatedLines.push(null);
      }
    }

    const totals = calculateDocumentTotals(validLines);
    return { calculatedLines, totals };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Line Items</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add items, rates, discounts, and applicable taxes. Totals update live for preview.
          </p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </button>
        )}
      </div>

      {/* Table of Line Items */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4 min-w-[200px]">Description</th>
              <th className="py-3 px-3 w-24">Qty</th>
              <th className="py-3 px-3 w-32">Unit Price ($)</th>
              <th className="py-3 px-3 w-40">Discount</th>
              <th className="py-3 px-3 w-28">Tax Rate (%)</th>
              <th className="py-3 px-4 text-right w-32">Line Total</th>
              {!disabled && <th className="py-3 px-2 w-10 text-center" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, idx) => {
              const calc = preview.calculatedLines[idx];
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Description */}
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      disabled={disabled}
                      placeholder="e.g. Enterprise License"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
                      required
                    />
                  </td>

                  {/* Quantity */}
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={disabled}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                        updateItem(idx, { quantity: val });
                      }}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 text-right"
                      required
                    />
                  </td>

                  {/* Unit Price */}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      disabled={disabled}
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 text-right font-mono"
                      required
                    />
                  </td>

                  {/* Discount */}
                  <td className="py-3 px-3">
                    <div className="flex gap-1.5">
                      <select
                        disabled={disabled}
                        value={item.discountType}
                        onChange={(e) =>
                          updateItem(idx, {
                            discountType: e.target.value as 'none' | 'fixed' | 'percentage',
                            discountValue: e.target.value === 'none' ? '' : item.discountValue,
                          })
                        }
                        className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white focus:border-slate-900 focus:outline-none disabled:bg-slate-50"
                      >
                        <option value="none">None</option>
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      {item.discountType !== 'none' && (
                        <input
                          type="text"
                          disabled={disabled}
                          placeholder={item.discountType === 'percentage' ? '10' : '5.00'}
                          value={item.discountValue}
                          onChange={(e) => updateItem(idx, { discountValue: e.target.value })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-2 py-1.5 focus:border-slate-900 focus:outline-none text-right font-mono"
                        />
                      )}
                    </div>
                  </td>

                  {/* Tax Rate */}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      disabled={disabled}
                      placeholder="0"
                      value={item.taxRate}
                      onChange={(e) => updateItem(idx, { taxRate: e.target.value })}
                      className="w-full text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-slate-900 focus:outline-none text-right font-mono"
                    />
                  </td>

                  {/* Calculated Total */}
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                    {calc ? `$${formatMoney(calc.totalCents)}` : '—'}
                  </td>

                  {/* Delete Row Button */}
                  {!disabled && (
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        disabled={items.length <= 1}
                        onClick={() => removeItem(idx)}
                        title="Remove line"
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Financial Summary Panel */}
      <div className="flex justify-end">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
            Calculated Preview
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-medium text-slate-900">
              ${formatMoney(preview.totals.subtotalCents)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Total Discounts:</span>
            <span className="font-mono font-medium text-slate-900">
              -${formatMoney(preview.totals.totalDiscountCents)}
            </span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Total Tax:</span>
            <span className="font-mono font-medium text-slate-900">
              +${formatMoney(preview.totals.totalTaxCents)}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-bold text-slate-950">
            <span>Grand Total:</span>
            <span className="font-mono text-lg text-slate-900">
              ${formatMoney(preview.totals.grandTotalCents)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
