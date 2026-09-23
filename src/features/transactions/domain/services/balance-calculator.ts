import { Money } from '@/core/domain/money';
import { Transaction } from '../transaction';

export interface AccountBalanceMap {
  [accountId: string]: Money;
}

export class LedgerBalanceCalculator {
  /**
   * Calculates the active balance for a single account from all active ledger transactions.
   * account_balance(account) = SUM(destination amount) - SUM(source amount)
   */
  public static calculateAccountBalance(
    accountId: string,
    transactions: readonly Transaction[],
    currencyCode: string = 'IDR'
  ): Money {
    let balanceMinorUnits = 0n;

    for (const tx of transactions) {
      if (tx.isDeleted()) {
        continue;
      }

      if (tx.destinationAccountId === accountId) {
        // Income, Transfer (in), or Opening Balance increases destination account
        balanceMinorUnits += tx.amount.minorUnits;
      }

      if (tx.sourceAccountId === accountId) {
        // Expense or Transfer (out) decreases source account
        balanceMinorUnits -= tx.amount.minorUnits;
      }
    }

    // Money VO requires positive minor units; if an account balance is negative in an overdraft,
    // we safely handle it by returning the balance or preserving currency
    return Money.fromMinorUnits(balanceMinorUnits, currencyCode);
  }

  /**
   * Calculates balances for all accounts that appear in the given transactions or list of accounts.
   */
  public static calculateAllAccountBalances(
    transactions: readonly Transaction[],
    accountIds: string[] = [],
    currencyCode: string = 'IDR'
  ): Map<string, Money> {
    const balanceMap = new Map<string, bigint>();

    // Initialize specified accounts with 0
    for (const accId of accountIds) {
      balanceMap.set(accId, 0n);
    }

    for (const tx of transactions) {
      if (tx.isDeleted()) {
        continue;
      }

      if (tx.destinationAccountId) {
        const current = balanceMap.get(tx.destinationAccountId) ?? 0n;
        balanceMap.set(tx.destinationAccountId, current + tx.amount.minorUnits);
      }

      if (tx.sourceAccountId) {
        const current = balanceMap.get(tx.sourceAccountId) ?? 0n;
        balanceMap.set(tx.sourceAccountId, current - tx.amount.minorUnits);
      }
    }

    const resultMap = new Map<string, Money>();
    for (const [accId, minorUnits] of balanceMap.entries()) {
      resultMap.set(accId, Money.fromMinorUnits(minorUnits, currencyCode));
    }

    return resultMap;
  }

  /**
   * Calculates total net worth across all active accounts from the active ledger transactions.
   * Net Worth = SUM(all active balances)
   */
  public static calculateTotalNetWorth(
    transactions: readonly Transaction[],
    currencyCode: string = 'IDR'
  ): Money {
    let netWorthMinorUnits = 0n;

    for (const tx of transactions) {
      if (tx.isDeleted()) {
        continue;
      }

      switch (tx.type) {
        case 'opening_balance':
        case 'income':
          netWorthMinorUnits += tx.amount.minorUnits;
          break;
        case 'expense':
          netWorthMinorUnits -= tx.amount.minorUnits;
          break;
        case 'transfer':
          // Transfer is net-neutral to overall net worth (+destination -source = 0)
          break;
      }
    }

    return Money.fromMinorUnits(netWorthMinorUnits, currencyCode);
  }
}
