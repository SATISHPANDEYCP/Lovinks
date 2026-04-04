const AuthImagePattern = ({ title, subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-base-200 px-8 pt-12 pb-6 overflow-hidden">
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto grid grid-cols-3 gap-2 w-fit mb-6">
          <div className="auth-grid-tracker" aria-hidden="true" />
          {[...Array(9)].map((_, i) => (
            <div key={i} className="w-20 h-20 rounded-xl bg-primary/10" />
          ))}
        </div>
        <h2 className="text-xl font-bold mb-3">{title}</h2>
        <p className="text-sm text-base-content/60 leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;
