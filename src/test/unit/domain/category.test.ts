import { Category, CategoryType } from '@/features/categories/domain/category';
import { ValidationError } from '@/core/domain/result';

describe('Category Domain Entity', () => {
  it('should instantiate a valid expense category', () => {
    const category = new Category({
      id: 'cat-food',
      userId: 'user-123',
      name: 'Makanan & Minuman',
      type: 'expense',
      icon: 'restaurant',
      color: '#FF5722',
    });

    expect(category.id).toBe('cat-food');
    expect(category.name).toBe('Makanan & Minuman');
    expect(category.type).toBe('expense');
    expect(category.isSystem).toBe(false);
    expect(category.isActive).toBe(true);
    expect(category.isDeleted()).toBe(false);
  });

  it('should instantiate a valid income category', () => {
    const category = new Category({
      id: 'cat-salary',
      userId: 'user-123',
      name: 'Gaji Bulanan',
      type: 'income',
    });

    expect(category.type).toBe('income');
  });

  it('should reject invalid category type', () => {
    expect(() => {
      new Category({
        id: 'cat-1',
        userId: 'user-1',
        name: 'Invalid',
        type: 'transfer' as unknown as CategoryType,
      });
    }).toThrow(ValidationError);
  });

  it('should prevent renaming and deleting system categories', () => {
    const systemCategory = new Category({
      id: 'cat-sys-1',
      userId: 'user-123',
      name: 'Makanan',
      type: 'expense',
      isSystem: true,
    });

    expect(() => systemCategory.rename('Makanan Baru')).toThrow(ValidationError);
    expect(() => systemCategory.markDeleted()).toThrow(ValidationError);
  });

  it('should allow renaming and soft deleting custom categories', () => {
    const customCategory = new Category({
      id: 'cat-custom-1',
      userId: 'user-123',
      name: 'Hobi',
      type: 'expense',
      isSystem: false,
    });

    customCategory.rename('Hobi & Hiburan');
    expect(customCategory.name).toBe('Hobi & Hiburan');

    customCategory.markDeleted();
    expect(customCategory.isDeleted()).toBe(true);
  });
});
