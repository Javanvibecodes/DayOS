import { create } from 'zustand';
import type { Category, CreateCategoryRequest } from '@/types';
import { categoryApi } from '@/lib/db/api';

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  loadCategories: () => Promise<void>;
  createCategory: (req: CreateCategoryRequest) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  getById: (id: string | null | undefined) => Category | undefined;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const categories = await categoryApi.getAll();
      set({ categories, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createCategory: async (req) => {
    const category = await categoryApi.create(req);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  deleteCategory: async (id) => {
    await categoryApi.delete(id);
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }));
  },

  getById: (id) => {
    if (!id) return undefined;
    return get().categories.find((c) => c.id === id);
  },
}));
