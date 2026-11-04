import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useNoteStore } from '@/stores/noteStore';
import { toast } from '@/stores/toastStore';
import type { Note } from '@/types';

export function NotesPage() {
  const {
    notes,
    folders,
    loadAll,
    createNote,
    updateNote,
    deleteNote,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useNoteStore();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [search, setSearch] = useState('');

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef({ title: '', content: '', noteId: null as string | null });

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleNotes = (selectedFolderId
    ? notes.filter((n) => n.folder_id === selectedFolderId)
    : notes
  ).filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  // Sync drafts when selection changes
  useEffect(() => {
    if (selectedNote) {
      setDraftTitle(selectedNote.title);
      setDraftContent(selectedNote.content);
      draftRef.current = {
        title: selectedNote.title,
        content: selectedNote.content,
        noteId: selectedNote.id,
      };
    } else {
      setDraftTitle('');
      setDraftContent('');
      draftRef.current = { title: '', content: '', noteId: null };
    }
    setSaveState('idle');
  }, [selectedNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushSave = async () => {
    const d = draftRef.current;
    if (!d.noteId) return;
    const current = notes.find((n) => n.id === d.noteId);
    if (!current) return;
    if (current.title === d.title && current.content === d.content) return;
    setSaveState('saving');
    try {
      await updateNote({ id: d.noteId, title: d.title, content: d.content });
      setSaveState('saved');
    } catch {
      setSaveState('idle');
    }
  };

  const scheduleSave = (next: { title?: string; content?: string }) => {
    draftRef.current = { ...draftRef.current, ...next };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      void flushSave();
    }, 500);
  };

  const handleSelectNote = async (note: Note) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    // Save previous note if dirty
    const d = draftRef.current;
    if (d.noteId && d.noteId !== note.id) {
      const prev = notes.find((n) => n.id === d.noteId);
      if (prev && (prev.title !== d.title || prev.content !== d.content)) {
        try {
          await updateNote({ id: d.noteId, title: d.title, content: d.content });
        } catch {
          // ignore
        }
      }
    }
    setSelectedNoteId(note.id);
  };

  const handleNewNote = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await flushSave();
    }
    const note = await createNote({
      title: 'Untitled note',
      content: '',
      folder_id: selectedFolderId ?? undefined,
    });
    setSelectedNoteId(note.id);
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await deleteNote(selectedNote.id);
    setSelectedNoteId(null);
    setSaveState('idle');
    toast.success('Note deleted');
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    const folder = await createFolder({ name });
    setNewFolderName('');
    setCreatingFolder(false);
    setSelectedFolderId(folder.id);
    toast.success(`Folder “${name}” created`);
  };

  const handleRenameFolder = async () => {
    if (!renamingFolderId) return;
    const name = renameFolderValue.trim();
    if (name) {
      await updateFolder({ id: renamingFolderId, name });
      toast.success('Folder renamed');
    }
    setRenamingFolderId(null);
    setRenameFolderValue('');
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    if (selectedFolderId === id) setSelectedFolderId(null);
    toast.success('Folder deleted — its notes are still in All Notes');
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!selectedNote) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await updateNote({
      id: selectedNote.id,
      title: draftRef.current.title,
      content: draftRef.current.content,
      folder_id: folderId ?? '',
    });
  };

  const folderName = (id: string | null) => {
    if (!id) return 'Unfiled';
    return folders.find((f) => f.id === id)?.name ?? 'Unfiled';
  };

  const snippet = (n: Note) => {
    const text = n.content.trim().replace(/\s+/g, ' ');
    return text || 'Empty note';
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="px-[32px] pt-[24px] pb-[16px] shrink-0 flex items-start justify-between gap-[20px]">
        <div>
          <h2 className="text-[28px] leading-9 font-semibold text-on-surface flex items-center gap-[12px]">
            <span className="material-symbols-outlined text-[32px] text-primary">sticky_note_2</span>
            Notes
          </h2>
          <p className="text-[14px] text-on-surface-variant mt-[6px]">
            Capture ideas, organize them into folders, and write freely.
          </p>
        </div>
        <div className="flex items-center gap-[12px]">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              className="w-[200px] bg-surface-container-low border border-outline-variant/30 rounded-lg py-[10px] pl-[38px] pr-[14px] text-[13px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <button
            onClick={() => {
              setCreatingFolder(true);
              setRenamingFolderId(null);
            }}
            className="bg-surface-container border border-outline-variant/30 hover:border-primary/50 text-on-surface font-semibold text-[13px] px-[16px] py-[10px] rounded-lg transition-all flex items-center justify-center gap-[8px] text-center"
          >
            <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
            New Folder
          </button>
          <button
            onClick={() => void handleNewNote()}
            className="bg-primary hover:bg-primary/90 text-on-primary font-semibold text-[13px] px-[20px] py-[10px] rounded-lg transition-all flex items-center justify-center gap-[8px] shadow-lg shadow-primary/20 text-center"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Note
          </button>
        </div>
      </div>

      {/* Body: folders | list | editor */}
      <div className="flex-1 flex min-h-0 border-t border-outline-variant/20">
        {/* Folders column */}
        <div className="w-[240px] shrink-0 border-r border-outline-variant/20 overflow-y-auto p-[16px] flex flex-col gap-[6px]">
          <p className="px-[10px] py-[6px] text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Folders
          </p>

          <button
            onClick={() => setSelectedFolderId(null)}
            className={
              selectedFolderId === null
                ? 'flex items-center gap-[12px] px-[12px] py-[10px] rounded-lg bg-primary-container text-on-primary-container font-semibold text-[13px] text-left w-full'
                : 'flex items-center gap-[12px] px-[12px] py-[10px] rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-[13px] text-left w-full transition-colors'
            }
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            <span className="flex-1 truncate">All Notes</span>
            <span className="text-[11px] opacity-70">{notes.length}</span>
          </button>

          {folders.map((folder) => {
            const count = notes.filter((n) => n.folder_id === folder.id).length;
            const active = selectedFolderId === folder.id;
            if (renamingFolderId === folder.id) {
              return (
                <div key={folder.id} className="flex items-center gap-[6px] px-[8px] py-[6px]">
                  <input
                    autoFocus
                    value={renameFolderValue}
                    onChange={(e) => setRenameFolderValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameFolder();
                      if (e.key === 'Escape') {
                        setRenamingFolderId(null);
                        setRenameFolderValue('');
                      }
                    }}
                    onBlur={() => void handleRenameFolder()}
                    className="flex-1 min-w-0 bg-surface-container-low border border-primary rounded px-[8px] py-[6px] text-[13px] text-on-surface focus:outline-none"
                  />
                </div>
              );
            }
            return (
              <div
                key={folder.id}
                className={
                  active
                    ? 'group flex items-center gap-[8px] px-[12px] py-[10px] rounded-lg bg-primary-container text-on-primary-container font-semibold text-[13px]'
                    : 'group flex items-center gap-[8px] px-[12px] py-[10px] rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface text-[13px] transition-colors cursor-pointer'
                }
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">folder</span>
                <span className="flex-1 truncate">{folder.name}</span>
                <span className="text-[11px] opacity-70 shrink-0">{count}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingFolderId(folder.id);
                    setRenameFolderValue(folder.name);
                    setCreatingFolder(false);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-[2px] rounded hover:bg-surface-container-highest shrink-0"
                  title="Rename folder"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteFolder(folder.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-[2px] rounded hover:bg-surface-container-highest shrink-0 hover:text-error"
                  title="Delete folder (notes are kept)"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
              </div>
            );
          })}

          {creatingFolder && (
            <div className="flex items-center gap-[6px] px-[8px] py-[6px]">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateFolder();
                  if (e.key === 'Escape') {
                    setCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                onBlur={() => void handleCreateFolder()}
                placeholder="Folder name"
                className="flex-1 min-w-0 bg-surface-container-low border border-primary rounded px-[8px] py-[6px] text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
              />
            </div>
          )}

          <p className="mt-[12px] px-[10px] text-[11px] text-on-surface-variant/70 leading-relaxed">
            Deleting a folder keeps its notes — they move to All Notes.
          </p>
        </div>

        {/* Notes list column */}
        <div className="w-[320px] shrink-0 border-r border-outline-variant/20 overflow-y-auto flex flex-col">
          <div className="px-[16px] py-[12px] border-b border-outline-variant/20 sticky top-0 bg-background z-10">
            <p className="text-[12px] font-semibold text-on-surface-variant">
              {selectedFolderId ? folderName(selectedFolderId) : 'All Notes'}{' '}
              <span className="font-normal opacity-70">· {visibleNotes.length}</span>
            </p>
          </div>

          {visibleNotes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-[10px] p-[24px] text-center">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">
                note_add
              </span>
              <p className="text-[13px] text-on-surface-variant">No notes here yet</p>
              <button
                onClick={() => void handleNewNote()}
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Create your first note
              </button>
            </div>
          ) : (
            visibleNotes.map((note) => {
              const active = note.id === selectedNoteId;
              return (
                <button
                  key={note.id}
                  onClick={() => void handleSelectNote(note)}
                  className={
                    active
                      ? 'text-left px-[16px] py-[14px] border-b border-outline-variant/10 bg-primary-container/20 border-l-2 border-l-primary'
                      : 'text-left px-[16px] py-[14px] border-b border-outline-variant/10 hover:bg-surface-container-high transition-colors border-l-2 border-l-transparent'
                  }
                >
                  <div className="flex items-start justify-between gap-[8px] mb-[4px]">
                    <h4
                      className={`text-[14px] font-semibold truncate ${
                        active ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {note.title.trim() || 'Untitled note'}
                    </h4>
                    <span className="text-[10px] font-mono text-on-surface-variant/70 shrink-0 mt-[2px]">
                      {format(new Date(note.updated_at.replace(' ', 'T') + 'Z'), 'MMM d')}
                    </span>
                  </div>
                  <p className="text-[12px] text-on-surface-variant line-clamp-2 leading-relaxed">
                    {snippet(note)}
                  </p>
                  {note.folder_id && (
                    <span className="inline-flex items-center gap-[4px] mt-[6px] text-[10px] text-on-surface-variant/80 bg-surface-container px-[6px] py-[1px] rounded">
                      <span className="material-symbols-outlined text-[11px]">folder</span>
                      {folderName(note.folder_id)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Editor column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-[12px] text-center p-[32px]">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">
                edit_note
              </span>
              <h3 className="text-[16px] font-semibold text-on-surface">Select a note to edit</h3>
              <p className="text-[13px] text-on-surface-variant max-w-[280px]">
                Choose a note from the list, or create a new one to start writing.
              </p>
              <button
                onClick={() => void handleNewNote()}
                className="mt-[4px] bg-primary hover:bg-primary/90 text-on-primary font-semibold text-[13px] px-[20px] py-[10px] rounded-lg transition-all flex items-center justify-center gap-[8px] text-center"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Note
              </button>
            </div>
          ) : (
            <>
              {/* Editor toolbar */}
              <div className="px-[24px] py-[12px] border-b border-outline-variant/20 flex items-center justify-between gap-[16px] shrink-0">
                <div className="flex items-center gap-[12px] min-w-0">
                  <select
                    value={selectedNote.folder_id ?? ''}
                    onChange={(e) => void handleMoveToFolder(e.target.value || null)}
                    className="bg-surface-container-low border border-outline-variant/30 rounded-lg px-[10px] py-[7px] text-[12px] text-on-surface focus:outline-none focus:border-primary max-w-[180px]"
                    title="Move to folder"
                  >
                    <option value="">Unfiled</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-mono text-on-surface-variant/70 truncate">
                    {saveState === 'saving'
                      ? 'Saving…'
                      : saveState === 'saved'
                        ? 'Saved'
                        : `Edited ${format(
                            new Date(selectedNote.updated_at.replace(' ', 'T') + 'Z'),
                            'MMM d, yyyy · HH:mm',
                          )}`}
                  </span>
                </div>
                <button
                  onClick={() => void handleDeleteNote()}
                  className="shrink-0 flex items-center justify-center gap-[6px] px-[12px] py-[7px] rounded-lg text-[12px] font-semibold text-error hover:bg-error-container/40 transition-colors text-center"
                  title="Delete note"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Delete
                </button>
              </div>

              {/* Title */}
              <div className="px-[32px] pt-[24px] shrink-0">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => {
                    setDraftTitle(e.target.value);
                    scheduleSave({ title: e.target.value });
                  }}
                  placeholder="Note title"
                  className="w-full bg-transparent text-[26px] font-semibold text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none border-none"
                />
              </div>

              {/* Content */}
              <div className="flex-1 px-[32px] py-[16px] min-h-0">
                <textarea
                  value={draftContent}
                  onChange={(e) => {
                    setDraftContent(e.target.value);
                    scheduleSave({ content: e.target.value });
                  }}
                  placeholder="Start writing…"
                  className="w-full h-full resize-none bg-transparent text-[15px] leading-[1.7] text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none border-none"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
