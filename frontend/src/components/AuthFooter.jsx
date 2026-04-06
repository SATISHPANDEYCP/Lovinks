import { Link } from "react-router-dom";

const AuthFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-base-300/70 bg-base-100/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-3 text-center text-xs text-base-content/70 sm:flex-row sm:items-center sm:justify-between sm:text-left sm:text-sm">
        <p className="leading-5">Copyright {currentYear} Lovinks. All rights reserved.</p>

        <div className="flex items-center justify-center gap-4 sm:justify-end">
          <Link to="/privacy" className="hover:text-base-content transition-colors py-1">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-base-content transition-colors py-1">
            Terms
          </Link>
          <a
            href="mailto:scrptix@gmail.com"
            className="hover:text-base-content transition-colors py-1"
          >
            Help
          </a>
        </div>
      </div>
    </footer>
  );
};

export default AuthFooter;
