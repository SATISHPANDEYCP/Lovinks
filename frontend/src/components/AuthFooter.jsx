import { Link } from "react-router-dom";

const AuthFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-base-300/70 bg-base-100/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 text-xs text-base-content/70 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <p>Copyright {currentYear} Lovinks. All rights reserved.</p>

        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-base-content transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-base-content transition-colors">
            Terms
          </Link>
          <a href="mailto:scrptix@gmail.com" className="hover:text-base-content transition-colors">
            Help
          </a>
        </div>
      </div>
    </footer>
  );
};

export default AuthFooter;
