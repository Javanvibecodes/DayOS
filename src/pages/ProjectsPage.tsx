import { useProjectStore } from '@/stores/projectStore';
import { useTaskStore } from '@/stores/taskStore';
import { toast } from '@/stores/toastStore';
import type { Project } from '@/types';

interface ProjectsPageProps {
  onNewProject?: () => void;
  onEditProject?: (project: Project) => void;
}

export function ProjectsPage({ onNewProject, onEditProject }: ProjectsPageProps) {
  const { projects, deleteProject } = useProjectStore();
  const { tasks } = useTaskStore();

  return (
    <div className="p-[32px] max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-[40px] mt-[20px]">
        <div>
          <h2 className="text-[28px] leading-9 font-semibold text-on-surface mb-[20px] flex items-center gap-[12px]">
            <span className="material-symbols-outlined text-[32px] text-primary">account_tree</span>
            Projects Workspace
          </h2>
          <p className="text-[14px] text-on-surface-variant">
            Manage your project initiatives, associated task pipelines, and project status.
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-[13px] px-[20px] py-[10px] rounded-lg transition-all flex items-center justify-center gap-[18px] shadow-lg shadow-primary/20 text-center"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Project
        </button>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[28px]">
        {projects.map((project) => {
          const projectTasks = tasks.filter((t) => t.project_id === project.id);
          const completedTasks = projectTasks.filter((t) => t.status === 'completed').length;
          const totalTasks = projectTasks.length;
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <div
              key={project.id}
              className="bg-surface rounded-xl border border-outline-variant/30 p-[28px] flex flex-col justify-between hover:border-primary/40 transition-all shadow-md group relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: project.color || '#8083ff' }}
              />
              <div>
                <div className="flex justify-between items-start mb-[20px]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container px-[8px] py-[2px] rounded border border-outline-variant/20">
                    {project.status}
                  </span>
                  <div className="flex gap-[14px] opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditProject && onEditProject(project)}
                      className="p-[4px] text-on-surface-variant hover:text-primary rounded hover:bg-surface-container transition-colors"
                      title="Edit Project"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => {
                        deleteProject(project.id);
                        toast.success('Project deleted');
                      }}
                      className="p-[4px] text-on-surface-variant hover:text-error rounded hover:bg-surface-container transition-colors"
                      title="Delete Project"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
                <h3 className="text-[20px] font-semibold text-on-surface mb-[16px] group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-[13px] text-on-surface-variant line-clamp-2 mb-[24px]">
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center text-[12px] font-mono text-on-surface-variant mb-[16px]">
                  <span>Progress</span>
                  <span className="text-on-surface font-semibold">{progress}% ({completedTasks}/{totalTasks} tasks)</span>
                </div>
                <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: project.color || '#8083ff',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
