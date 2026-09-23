import { useState, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useGoalStore } from '@/stores/goalStore';
import { useCategoryStore } from '@/stores/categoryStore';
import type { Project } from '@/types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

export function ProjectModal({ isOpen, onClose, projectToEdit }: ProjectModalProps) {
  const { createProject, updateProject } = useProjectStore();
  const { goals } = useGoalStore();
  const { categories, loadCategories } = useCategoryStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#8083ff');
  const [goalId, setGoalId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description || '');
      setColor(projectToEdit.color || '#8083ff');
      setGoalId(projectToEdit.goal_id || '');
      setCategoryId(projectToEdit.category_id || '');
    } else {
      setName('');
      setDescription('');
      setColor('#8083ff');
      setGoalId('');
      setCategoryId('');
    }
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (projectToEdit) {
      updateProject({
        id: projectToEdit.id,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        goal_id: goalId || undefined,
        category_id: categoryId,
      });
    } else {
      createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        goal_id: goalId || undefined,
        category_id: categoryId || undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-[16px]">
      <div className="bg-surface border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-[24px] py-[16px] border-b border-outline-variant/20 bg-surface-container-low">
          <h3 className="text-[18px] font-semibold text-on-surface flex items-center gap-[18px] mb-[8px]">
            <span className="material-symbols-outlined text-primary">account_tree</span>
            {projectToEdit ? 'Edit Project' : 'Create New Project'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tournament Management"
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project scope or summary..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-[20px]">
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Parent Goal
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">None</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
                Theme Color
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 bg-surface-container-low border border-outline-variant/30 rounded-lg px-[4px] py-[4px] cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant mb-[12px]">
              Category <span className="normal-case font-medium opacity-60">(optional)</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-[12px] py-[10px] text-[14px] text-on-surface focus:outline-none focus:border-primary"
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-on-surface-variant/70 mt-[6px]">
              Tasks under this project inherit its category when they don't have their own.
            </p>
          </div>

          <div className="flex justify-end gap-[16px] mt-[16px] pt-[20px] border-t border-outline-variant/20">
            <button
              type="button"
              onClick={onClose}
              className="px-[20px] py-[10px] rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-[13px] font-medium flex items-center justify-center text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-[24px] py-[10px] rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-[13px] font-semibold transition-colors flex items-center justify-center gap-[16px] shadow-lg shadow-primary/20 text-center"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              {projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
