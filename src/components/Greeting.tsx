import { useState, useEffect } from "react";

function getGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Greeting() {
  const [now, setNow] = useState(new Date());
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-username");
    if (stored) {
      setName(stored);
    } else {
      setEditing(true);
    }
  }, []);

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setName(trimmed);
      localStorage.setItem("dashboard-username", trimmed);
    }
    setEditing(false);
  };

  const greeting = getGreeting(now.getHours());

  return (
    <div className="text-center mb-6 select-none">
      <div className="text-7xl sm:text-8xl font-extralight tracking-tight text-gray-800/90 dark:text-white/90 mb-2">
        {formatTime(now)}
      </div>
      <div className="text-base font-light text-gray-500/70 dark:text-white/40 mb-1 tracking-wide">
        {formatDate(now)}
      </div>
      {editing ? (
        <div className="flex items-center justify-center gap-2 mt-3">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            placeholder="Enter your name"
            className="input-field max-w-[200px] text-center text-sm"
            autoFocus
          />
          <button onClick={saveName} className="btn-primary text-sm py-2">
            Save
          </button>
        </div>
      ) : (
        <div
          className="text-2xl sm:text-3xl font-light text-gray-600/80 dark:text-white/60 mt-1
                     cursor-pointer hover:text-gray-700 dark:hover:text-white/70 transition-colors duration-200"
          onClick={() => {
            setNameInput(name);
            setEditing(true);
          }}
          title="Click to change name"
        >
          {greeting}
          {name && `, ${name}`}
        </div>
      )}
    </div>
  );
}
