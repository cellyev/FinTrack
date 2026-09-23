export type TransactionType = 'income' | 'expense' | 'transfer' | 'opening_balance';

export const TRANSACTION_TYPES: readonly TransactionType[] = [
  'income',
  'expense',
  'transfer',
  'opening_balance',
] as const;

export function isValidTransactionType(type: string): type is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(type);
}
