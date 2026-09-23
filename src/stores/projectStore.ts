import { create } from 'zustand';
import type { Project, CreateProjectRequest, UpdateProjectRequest } from '@/types';
import { projectApi } from '@/lib/db/api';

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  loadProjects: () => Promise<void>;
  createProject: (req: CreateProjectRequest) => Promise<Project>;
  updateProject: (req: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
  
  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectApi.getAll();
      set({ projects, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },
  
  createProject: async (req: CreateProjectRequest) => {
    const project = await projectApi.create(req);
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  },
  
  updateProject: async (req: UpdateProjectRequest) => {
    const project = await projectApi.update(req);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === req.id ? project : p)),
      selectedProject: state.selectedProject?.id === req.id ? project : state.selectedProject,
    }));
    return project;
  },
  
  deleteProject: async (id: string) => {
    await projectApi.delete(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
    }));
  },
  
  setSelectedProject: (project: Project | null) => {
    set({ selectedProject: project });
  },
}));
