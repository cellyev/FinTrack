import { Account, AccountType } from '@/features/accounts/domain/account';
import { ValidationError } from '@/core/domain/result';

describe('Account Domain Entity', () => {
  it('should instantiate a valid cash account', () => {
    const account = new Account({
      id: 'acc-123',
      userId: 'user-123',
      name: 'Dompet Tunai',
      type: 'cash',
    });

    expect(account.id).toBe('acc-123');
    expect(account.userId).toBe('user-123');
    expect(account.name).toBe('Dompet Tunai');
    expect(account.type).toBe('cash');
    expect(account.currencyCode).toBe('IDR');
    expect(account.isActive).toBe(true);
    expect(account.isDeleted()).toBe(false);
  });

  it('should instantiate bank and ewallet accounts', () => {
    const bank = new Account({
      id: 'acc-bank',
      userId: 'user-123',
      name: 'BCA Rekening Utama',
      type: 'bank',
      color: '#0055A5',
    });
    expect(bank.type).toBe('bank');

    const ewallet = new Account({
      id: 'acc-ewallet',
      userId: 'user-123',
      name: 'GoPay',
      type: 'ewallet',
    });
    expect(ewallet.type).toBe('ewallet');
  });

  it('should reject account with empty name', () => {
    expect(() => {
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: '   ',
        type: 'cash',
      });
    }).toThrow(ValidationError);
  });

  it('should reject account with name longer than 80 characters', () => {
    expect(() => {
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'A'.repeat(81),
        type: 'bank',
      });
    }).toThrow(ValidationError);
  });

  it('should reject account with invalid type', () => {
    expect(() => {
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Crypto Wallet',
        type: 'crypto' as unknown as AccountType,
      });
    }).toThrow(ValidationError);
  });

  it('should support rename, deactivate, activate, and markDeleted', () => {
    const account = new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'BCA Lama',
      type: 'bank',
    });

    account.rename('BCA Tabungan');
    expect(account.name).toBe('BCA Tabungan');

    account.deactivate();
    expect(account.isActive).toBe(false);

    account.activate();
    expect(account.isActive).toBe(true);

    account.markDeleted();
    expect(account.isDeleted()).toBe(true);
    expect(account.deletedAt).not.toBeNull();
  });
});
