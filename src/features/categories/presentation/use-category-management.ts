import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/features/auth/presentation/use-auth';
import { SqliteCategoryRepository } from '../data/sqlite-category.repository';
import {
  ListCategoriesUseCase,
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  ArchiveCategoryUseCase,
  EnsureDefaultCategoriesUseCase,
  CreateCategoryDTO,
  UpdateCategoryDTO,
} from '../application/category.usecases';
import { Category, CategoryType } from '../domain/category';
import { ExpoUuidGenerator } from '@/core/infrastructure/crypto/expo-uuid-generator';
import { SyncCoordinator } from '@/core/sync/application/sync-coordinator';
import { appEvents } from '@/core/events/app-events';

const categoryRepo = new SqliteCategoryRepository();
const uuidGen = new ExpoUuidGenerator();
const syncCoordinator = SyncCoordinator.getInstance();

const listCategoriesUseCase = new ListCategoriesUseCase(categoryRepo);
const createCategoryUseCase = new CreateCategoryUseCase(categoryRepo, uuidGen);
const updateCategoryUseCase = new UpdateCategoryUseCase(categoryRepo);
const archiveCategoryUseCase = new ArchiveCategoryUseCase(categoryRepo);
const ensureDefaultsUseCase = new EnsureDefaultCategoriesUseCase(categoryRepo, uuidGen);

export function useCategoryManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. Ensure default system categories are seeded idempotently
    await ensureDefaultsUseCase.execute(user.id);

    // 2. Fetch all active categories for this user
    const result = await listCategoriesUseCase.execute(user.id, undefined, false);
    if (result.success) {
      setCategories(result.data);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCategories();

    const unsubscribe = appEvents.subscribe(['categories_changed', 'data_invalidated'], () => {
      fetchCategories();
    });

    return unsubscribe;
  }, [fetchCategories]);

  const filteredCategories = categories.filter((c) => c.type === activeTab);
  const systemCategories = filteredCategories.filter((c) => c.isSystem);
  const customCategories = filteredCategories.filter((c) => !c.isSystem);

  const createCategory = async (data: Omit<CreateCategoryDTO, 'userId'>) => {
    if (!user) return { success: false, error: 'User tidak ditemukan' };
    const result = await createCategoryUseCase.execute({
      ...data,
      userId: user.id,
    });
    if (result.success) {
      appEvents.emit('categories_changed');
      syncCoordinator.requestSync('manual');
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  };

  const updateCategory = async (data: Omit<UpdateCategoryDTO, 'userId'>) => {
    if (!user) return { success: false, error: 'User tidak ditemukan' };
    const result = await updateCategoryUseCase.execute({
      ...data,
      userId: user.id,
    });
    if (result.success) {
      appEvents.emit('categories_changed');
      syncCoordinator.requestSync('manual');
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  };

  const archiveCategory = async (id: string) => {
    if (!user) return { success: false, error: 'User tidak ditemukan' };
    const result = await archiveCategoryUseCase.execute(id, user.id);
    if (result.success) {
      appEvents.emit('categories_changed');
      syncCoordinator.requestSync('manual');
      return { success: true };
    }
    return { success: false, error: result.error.message };
  };

  return {
    activeTab,
    setActiveTab,
    categories,
    systemCategories,
    customCategories,
    isLoading,
    error,
    refresh: fetchCategories,
    createCategory,
    updateCategory,
    archiveCategory,
  };
}
