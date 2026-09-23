import { Money } from '@/core/domain/money';

describe('Money Value Object', () => {
  it('should initialize correctly from minor units', () => {
    const money = Money.fromMinorUnits(5000000n, 'IDR');
    expect(money.minorUnits).toBe(5000000n);
    expect(money.toDecimal()).toBe(50000);
    expect(money.currencyCode).toBe('IDR');
  });

  it('should initialize correctly from decimal', () => {
    const money = Money.fromDecimal(12500.5, 'IDR');
    expect(money.minorUnits).toBe(1250050n);
    expect(money.toDecimal()).toBe(12500.5);
  });

  it('should accurately perform addition without floating point inaccuracies', () => {
    const a = Money.fromDecimal(0.1, 'IDR');
    const b = Money.fromDecimal(0.2, 'IDR');
    const sum = a.add(b);

    expect(sum.toDecimal()).toBe(0.3);
    expect(sum.minorUnits).toBe(30n);
  });

  it('should accurately perform subtraction', () => {
    const a = Money.fromDecimal(100000, 'IDR');
    const b = Money.fromDecimal(35000, 'IDR');
    const diff = a.subtract(b);

    expect(diff.toDecimal()).toBe(65000);
  });

  it('should throw error when subtracting to a negative value', () => {
    const a = Money.fromDecimal(20000, 'IDR');
    const b = Money.fromDecimal(50000, 'IDR');

    expect(() => a.subtract(b)).toThrow('Subtraction result would be negative');
  });

  it('should throw error when adding different currencies', () => {
    const idr = Money.fromDecimal(10000, 'IDR');
    const usd = Money.fromDecimal(10, 'USD');

    expect(() => idr.add(usd)).toThrow('Currency mismatch');
  });

  it('should format IDR display string properly', () => {
    const money = Money.fromDecimal(75000, 'IDR');
    expect(money.formatDisplay()).toContain('Rp');
  });

  it('should compare equality correctly', () => {
    const a = Money.fromDecimal(50000, 'IDR');
    const b = Money.fromDecimal(50000, 'IDR');
    const c = Money.fromDecimal(60000, 'IDR');

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
