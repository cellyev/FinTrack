/**
 * Money Value Object (Domain Layer)
 * Stores money as integer minor units (e.g. cents/sen) to eliminate floating-point arithmetic errors.
 * For IDR (Indonesian Rupiah), minor unit is 1 IDR (0 decimal fraction places in standard daily use,
 * but supports 2 decimal places precision: 100 minor units = Rp 1.00).
 */
export class Money {
  private readonly _minorUnits: bigint;
  private readonly _currencyCode: string;

  private constructor(minorUnits: bigint, currencyCode: string = 'IDR') {
    if (minorUnits < 0n) {
      throw new Error('Money amount must be a positive integer or zero');
    }
    this._minorUnits = minorUnits;
    this._currencyCode = currencyCode.toUpperCase();
  }

  public static fromMinorUnits(minorUnits: bigint | number, currencyCode: string = 'IDR'): Money {
    return new Money(BigInt(Math.round(Number(minorUnits))), currencyCode);
  }

  /**
   * Creates a Money instance from standard decimal value (e.g., 50000 -> 5000000 minor units if 2 decimals).
   * Precision: 2 decimal places.
   */
  public static fromDecimal(decimalAmount: number, currencyCode: string = 'IDR'): Money {
    if (isNaN(decimalAmount) || !isFinite(decimalAmount) || decimalAmount < 0) {
      throw new Error('Decimal amount must be a non-negative finite number');
    }
    // Convert to minor units with 2 decimal places: 12.34 -> 1234
    const minorUnits = BigInt(Math.round(decimalAmount * 100));
    return new Money(minorUnits, currencyCode);
  }

  public static zero(currencyCode: string = 'IDR'): Money {
    return new Money(0n, currencyCode);
  }

  public get minorUnits(): bigint {
    return this._minorUnits;
  }

  public get currencyCode(): string {
    return this._currencyCode;
  }

  public toDecimal(): number {
    return Number(this._minorUnits) / 100;
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._minorUnits + other.minorUnits, this._currencyCode);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (this._minorUnits < other.minorUnits) {
      throw new Error('Subtraction result would be negative, which is not permitted for positive Money values');
    }
    return new Money(this._minorUnits - other.minorUnits, this._currencyCode);
  }

  public equals(other: Money): boolean {
    return this._currencyCode === other.currencyCode && this._minorUnits === other.minorUnits;
  }

  public isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._minorUnits > other.minorUnits;
  }

  public isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._minorUnits < other.minorUnits;
  }

  public formatDisplay(): string {
    const decimal = this.toDecimal();
    if (this._currencyCode === 'IDR') {
      return `Rp ${Math.floor(decimal).toLocaleString('id-ID')}`;
    }
    return `${this._currencyCode} ${decimal.toFixed(2)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this._currencyCode !== other.currencyCode) {
      throw new Error(`Currency mismatch: cannot operate between ${this._currencyCode} and ${other.currencyCode}`);
    }
  }
}
