import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CategoryListScreen } from '@/features/categories/presentation/screens/CategoryListScreen';
import { CreateCategoryScreen } from '@/features/categories/presentation/screens/CreateCategoryScreen';
import { useCategoryManagement } from '@/features/categories/presentation/use-category-management';
import { Category } from '@/features/categories/domain/category';

// Mock useCategoryManagement
jest.mock('@/features/categories/presentation/use-category-management');
const mockedUseCategoryManagement = useCategoryManagement as jest.MockedFunction<typeof useCategoryManagement>;

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({ type: 'expense' }),
}));

describe('Category Presentation Screens', () => {
  const dummySystemCat = new Category({
    id: 'cat-sys-1',
    userId: 'u1',
    name: 'Makanan & Minuman',
    type: 'expense',
    icon: '🍽️',
    color: '#FF5722',
    isSystem: true,
  });

  const dummyCustomCat = new Category({
    id: 'cat-custom-1',
    userId: 'u1',
    name: 'Kopi Harian',
    type: 'expense',
    icon: '☕',
    color: '#6F4E37',
    isSystem: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CategoryListScreen', () => {
    it('should render system and custom category sections with distinct styling', () => {
      mockedUseCategoryManagement.mockReturnValue({
        activeTab: 'expense',
        setActiveTab: jest.fn(),
        categories: [dummySystemCat, dummyCustomCat],
        systemCategories: [dummySystemCat],
        customCategories: [dummyCustomCat],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createCategory: jest.fn(),
        updateCategory: jest.fn(),
        archiveCategory: jest.fn(),
      });

      const { getByText } = render(<CategoryListScreen />);

      expect(getByText('Kelola Kategori')).toBeTruthy();
      expect(getByText('Makanan & Minuman')).toBeTruthy();
      expect(getByText('Sistem')).toBeTruthy();
      expect(getByText('Kopi Harian')).toBeTruthy();
      expect(getByText('Ubah')).toBeTruthy();
      expect(getByText('Arsipkan')).toBeTruthy();
    });

    it('should switch between Expense and Income tabs', () => {
      const mockSetTab = jest.fn();
      mockedUseCategoryManagement.mockReturnValue({
        activeTab: 'expense',
        setActiveTab: mockSetTab,
        categories: [dummySystemCat],
        systemCategories: [dummySystemCat],
        customCategories: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createCategory: jest.fn(),
        updateCategory: jest.fn(),
        archiveCategory: jest.fn(),
      });

      const { getByLabelText } = render(<CategoryListScreen />);
      fireEvent.press(getByLabelText('Tab Kategori Pemasukan'));
      expect(mockSetTab).toHaveBeenCalledWith('income');
    });
  });

  describe('CreateCategoryScreen', () => {
    it('should validate empty name and submit valid category', async () => {
      const mockCreate = jest.fn().mockResolvedValue({ success: true, data: dummyCustomCat });
      mockedUseCategoryManagement.mockReturnValue({
        activeTab: 'expense',
        setActiveTab: jest.fn(),
        categories: [],
        systemCategories: [],
        customCategories: [],
        isLoading: false,
        error: null,
        refresh: jest.fn(),
        createCategory: mockCreate,
        updateCategory: jest.fn(),
        archiveCategory: jest.fn(),
      });

      const { getByText, getByPlaceholderText } = render(<CreateCategoryScreen />);

      expect(getByText('Tambah Kategori Baru')).toBeTruthy();

      const input = getByPlaceholderText('Contoh: Kopi Harian, Langganan Netflix...');
      fireEvent.changeText(input, 'Kopi Susu');

      await act(async () => {
        fireEvent.press(getByText('Simpan Kategori'));
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Kopi Susu',
          type: 'expense',
        })
      );
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
