import { create } from 'zustand';
import type { Goal, CreateGoalRequest, UpdateGoalRequest } from '@/types';
import { goalApi } from '@/lib/db/api';

interface GoalState {
  goals: Goal[];
  selectedGoal: Goal | null;
  isLoading: boolean;
  error: string | null;
  
  loadGoals: () => Promise<void>;
  createGoal: (req: CreateGoalRequest) => Promise<Goal>;
  updateGoal: (req: UpdateGoalRequest) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  setSelectedGoal: (goal: Goal | null) => void;
}

export const useGoalStore = create<GoalState>((set) => ({
  goals: [],
  selectedGoal: null,
  isLoading: false,
  error: null,
  
  loadGoals: async () => {
    set({ isLoading: true, error: null });
    try {
      const goals = await goalApi.getAll();
      set({ goals, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  createGoal: async (req: CreateGoalRequest) => {
    const goal = await goalApi.create(req);
    set((state) => ({ goals: [...state.goals, goal] }));
    return goal;
  },
  
  updateGoal: async (req: UpdateGoalRequest) => {
    const goal = await goalApi.update(req);
    set((state) => ({
      goals: state.goals.map((g) => (g.id === req.id ? goal : g)),
      selectedGoal: state.selectedGoal?.id === req.id ? goal : state.selectedGoal,
    }));
    return goal;
  },
  
  deleteGoal: async (id: string) => {
    await goalApi.delete(id);
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
      selectedGoal: state.selectedGoal?.id === id ? null : state.selectedGoal,
    }));
  },
  
  setSelectedGoal: (goal: Goal | null) => {
    set({ selectedGoal: goal });
  },
}));
