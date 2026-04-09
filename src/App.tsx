import { useState, useEffect } from "react";
import ThemeToggle from "./components/ThemeToggle";
import WallpaperSettings from "./components/WallpaperSettings";
import HomelabSidebar from "./components/HomelabSidebar";
import TileLayout from "./components/TileLayout";

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [wallpaper, setWallpaper] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    const savedWallpaper = localStorage.getItem("dashboard-wallpaper");
    if (savedWallpaper) setWallpaper(savedWallpaper);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("dashboard-theme", next ? "dark" : "light");
      return next;
    });
  };

  const hasWallpaper = !!wallpaper;

  return (
    <div className="min-h-screen relative transition-colors duration-500">
      {/* Background layer */}
      {hasWallpaper ? (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${wallpaper})` }}
        />
      ) : (
        <div className="fixed inset-0 z-0 bg-[#f2f2f7] dark:bg-[#1c1c1e] transition-colors duration-500" />
      )}

      {/* Frosted overlay when wallpaper is set */}
      {hasWallpaper && (
        <div className="fixed inset-0 z-[1] backdrop-blur-sm bg-black/10 dark:bg-black/30" />
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top bar */}
        <div className="flex items-start justify-end mb-6 animate-in delay-1">
          <div className="flex items-center gap-2">
            <WallpaperSettings wallpaper={wallpaper} onWallpaperChange={(url) => {
              setWallpaper(url);
              localStorage.setItem("dashboard-wallpaper", url);
            }} />
            <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
          </div>
        </div>

        {/* Tile-based customizable dashboard */}
        <div className="animate-in delay-2">
          <TileLayout />
        </div>
      </div>

      {/* Homelab sidebar */}
      <HomelabSidebar />
    </div>
  );
}
