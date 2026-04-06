import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, User, Palette } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { THEMES } from "../constants";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const handleThemeToggle = () => {
    const currentIndex = THEMES.indexOf(theme);
    const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
    setTheme(nextTheme);
  };

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
              <div className="size-10 flex items-center justify-center">
                <img src="/lovinks.png" alt="Lovinks" className="w-8 h-8 object-contain" />
              </div>
              <h1 className="text-lg font-bold brand-word">Lovinks</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-sm gap-2" onClick={handleThemeToggle}>
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline capitalize">{theme}</span>
            </button>

            {authUser && (
              <>
                <Link to={"/profile"} className={`btn btn-sm gap-2`}>
                  <User className="size-5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button
                  className="flex items-center justify-center text-base-content hover:text-primary transition-colors"
                  onClick={logout}
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="size-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
