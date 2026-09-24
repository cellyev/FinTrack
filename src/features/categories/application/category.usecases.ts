import { Result, ok, err, ValidationError, NotFoundError, DomainError } from '@/core/domain/result';
import { Category, CategoryType } from '../domain/category';
import { ICategoryRepository } from '../domain/category-repository.interface';
import { IUuidGenerator } from '@/core/domain/uuid-generator.interface';

export interface CreateCategoryDTO {
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string | null;
  color?: string | null;
  isSystem?: boolean;
  sortOrder?: number;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly uuidGenerator: IUuidGenerator
  ) {}

  public async execute(dto: CreateCategoryDTO): Promise<Result<Category, DomainError>> {
    try {
      const trimmedName = dto.name ? dto.name.trim() : '';
      if (!trimmedName) {
        return err(new ValidationError('Nama kategori wajib diisi'));
      }

      // Validate duplicate category name (case-insensitive) for the same user and type
      const existingResult = await this.categoryRepository.listByUser(dto.userId, dto.type, true);
      if (existingResult.success) {
        const isDuplicate = existingResult.data.some(
          (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
          return err(new ValidationError('Kategori dengan nama tersebut sudah ada'));
        }
      }

      const id = this.uuidGenerator.generate();
      const category = new Category({
        id,
        userId: dto.userId,
        name: trimmedName,
        type: dto.type,
        icon: dto.icon,
        color: dto.color,
        isSystem: dto.isSystem ?? false,
        sortOrder: dto.sortOrder ?? 0,
      });

      const result = await this.categoryRepository.create(category);
      if (!result.success) {
        return err(result.error);
      }

      return ok(category);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

export interface UpdateCategoryDTO {
  id: string;
  userId: string;
  name?: string;
  icon?: string | null;
  color?: string | null;
}

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  public async execute(dto: UpdateCategoryDTO): Promise<Result<Category, DomainError>> {
    try {
      const findResult = await this.categoryRepository.findById(dto.id, dto.userId);
      if (!findResult.success) {
        return err(findResult.error);
      }

      const category = findResult.data;
      if (!category) {
        return err(new NotFoundError(`Kategori dengan ID ${dto.id} tidak ditemukan`));
      }

      if (category.isSystem) {
        return err(new ValidationError('Kategori sistem tidak dapat diubah'));
      }

      if (dto.name !== undefined) {
        const trimmedName = dto.name.trim();
        if (!trimmedName) {
          return err(new ValidationError('Nama kategori wajib diisi'));
        }

        // Validate duplicate if renaming
        if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
          const listResult = await this.categoryRepository.listByUser(dto.userId, category.type, true);
          if (listResult.success) {
            const isDuplicate = listResult.data.some(
              (c) => c.id !== category.id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
            );
            if (isDuplicate) {
              return err(new ValidationError('Kategori dengan nama tersebut sudah ada'));
            }
          }
        }
      }

      category.update({
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
      });

      const updateResult = await this.categoryRepository.update(category);
      if (!updateResult.success) {
        return err(updateResult.error);
      }

      return ok(category);
    } catch (e: unknown) {
      return err(e instanceof DomainError ? e : new ValidationError((e as Error).message));
    }
  }
}

export class ArchiveCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  public async execute(id: string, userId: string): Promise<Result<void, DomainError>> {
    const findResult = await this.categoryRepository.findById(id, userId);
    if (!findResult.success) {
      return err(findResult.error);
    }

    const category = findResult.data;
    if (!category) {
      return err(new NotFoundError(`Kategori dengan ID ${id} tidak ditemukan`));
    }

    if (category.isSystem) {
      return err(new ValidationError('Kategori sistem tidak dapat diarsipkan'));
    }

    return this.categoryRepository.softDelete(id, userId);
  }
}

export class GetCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  public async execute(id: string, userId: string): Promise<Result<Category | null, DomainError>> {
    return this.categoryRepository.findById(id, userId);
  }
}

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  public async execute(
    userId: string,
    type?: CategoryType,
    includeInactive: boolean = false
  ): Promise<Result<Category[], DomainError>> {
    return this.categoryRepository.listByUser(userId, type, includeInactive);
  }
}

export interface DefaultCategoryTemplate {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sortOrder: number;
}

export const DEFAULT_SYSTEM_CATEGORIES: DefaultCategoryTemplate[] = [
  // Expense Categories
  { name: 'Makanan & Minuman', type: 'expense', icon: '🍽️', color: '#FF5722', sortOrder: 1 },
  { name: 'Transportasi', type: 'expense', icon: '🚗', color: '#03A9F4', sortOrder: 2 },
  { name: 'Belanja', type: 'expense', icon: '🛍️', color: '#E91E63', sortOrder: 3 },
  { name: 'Tagihan & Utilitas', type: 'expense', icon: '🧾', color: '#FF9800', sortOrder: 4 },
  { name: 'Hiburan & Hobi', type: 'expense', icon: '🎮', color: '#9C27B0', sortOrder: 5 },
  { name: 'Kesehatan', type: 'expense', icon: '💊', color: '#4CAF50', sortOrder: 6 },
  { name: 'Pendidikan', type: 'expense', icon: '📚', color: '#3F51B5', sortOrder: 7 },
  { name: 'Lainnya', type: 'expense', icon: '📦', color: '#607D8B', sortOrder: 8 },

  // Income Categories
  { name: 'Gaji Bulanan', type: 'income', icon: '💵', color: '#2E7D32', sortOrder: 1 },
  { name: 'Bonus & THR', type: 'income', icon: '🎁', color: '#F9A825', sortOrder: 2 },
  { name: 'Investasi & Usaha', type: 'income', icon: '📈', color: '#00897B', sortOrder: 3 },
  { name: 'Hadiah & Uang Saku', type: 'income', icon: '🎉', color: '#7B1FA2', sortOrder: 4 },
  { name: 'Pemasukan Lainnya', type: 'income', icon: '💰', color: '#546E7A', sortOrder: 5 },
];

export class EnsureDefaultCategoriesUseCase {
  // Concurrency lock to prevent multiple simultaneous seeding
  private static seedingPromises: Record<string, Promise<Result<Category[], DomainError>>> = {};

  constructor(
    private readonly categoryRepository: ICategoryRepository,
    private readonly uuidGenerator: IUuidGenerator
  ) {}

  public async execute(userId: string): Promise<Result<Category[], DomainError>> {
    const existingPromise = EnsureDefaultCategoriesUseCase.seedingPromises[userId];
    if (existingPromise !== undefined) {
      return existingPromise;
    }

    const promise = this._execute(userId).finally(() => {
      delete EnsureDefaultCategoriesUseCase.seedingPromises[userId];
    });

    EnsureDefaultCategoriesUseCase.seedingPromises[userId] = promise;
    return promise;
  }

  private async _execute(userId: string): Promise<Result<Category[], DomainError>> {
    // Include inactive categories to prevent re-seeding if user has archived all system categories
    const listResult = await this.categoryRepository.listByUser(userId, undefined, true);
    if (!listResult.success) {
      return err(listResult.error);
    }

    if (listResult.data.length > 0) {
      return ok(listResult.data);
    }

    // Seed default categories
    const createdCategories: Category[] = [];
    for (const template of DEFAULT_SYSTEM_CATEGORIES) {
      const id = this.uuidGenerator.generate();
      const category = new Category({
        id,
        userId,
        name: template.name,
        type: template.type,
        icon: template.icon,
        color: template.color,
        isSystem: true,
        sortOrder: template.sortOrder,
      });

      const createResult = await this.categoryRepository.create(category);
      if (!createResult.success) {
        return err(createResult.error);
      }
      createdCategories.push(category);
    }

    return ok(createdCategories);
  }
}
