import { useState, useEffect, useRef } from "react";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

const STORAGE_KEY = "dashboard-tasks";

function loadTasks(): Task[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export default function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [newTask, setNewTask] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks((prev) => [
      ...prev,
      { id: `task-${Date.now()}`, text, completed: false, createdAt: Date.now() },
    ]);
    setNewTask("");
    inputRef.current?.focus();
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setTasks((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="widget-card flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <svg className="w-[18px] h-[18px] text-gray-500/60 dark:text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="font-medium text-[15px] text-gray-700/80 dark:text-white/60">Tasks</h2>
        </div>
        {totalCount > 0 && (
          <span className="text-xs text-gray-400/50 dark:text-white/20 font-light">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task..."
          className="input-field text-sm"
        />
        <button onClick={addTask} className="btn-primary text-sm whitespace-nowrap">
          Add
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto pr-1">
        {tasks.length === 0 && (
          <div className="text-center text-gray-400/40 dark:text-white/15 text-sm py-6 font-light">
            No tasks yet. Add one above!
          </div>
        )}
        {tasks.map((task, index) => (
          <div
            key={task.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl group
                        cursor-grab active:cursor-grabbing
                        transition-all duration-200
                        ${dragOverIndex === index
                          ? "scale-[1.01]"
                          : ""}
                        ${dragIndex === index ? "opacity-40" : ""}`}
            style={dragOverIndex === index
              ? { background: "rgba(0,122,255,0.04)" }
              : {}}
            onMouseEnter={(e) => {
              if (dragOverIndex !== index) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
            }}
            onMouseLeave={(e) => {
              if (dragOverIndex !== index) e.currentTarget.style.background = "transparent";
            }}
          >
            <svg className="w-3.5 h-3.5 text-gray-300/40 dark:text-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
            </svg>

            <button
              onClick={() => toggleTask(task.id)}
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0
                         transition-all duration-200"
              style={task.completed
                ? { background: "rgba(0,122,255,0.7)" }
                : { border: "1.5px solid rgba(0,0,0,0.12)" }}
            >
              {task.completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <span className={`flex-1 text-[13px] transition-all duration-200 ${
              task.completed
                ? "line-through text-gray-400/40 dark:text-white/15"
                : "text-gray-700/80 dark:text-white/60"
            }`}>
              {task.text}
            </span>

            <button
              onClick={() => deleteTask(task.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg
                         text-gray-400/40 hover:text-red-400/70
                         transition-all duration-200 flex-shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
