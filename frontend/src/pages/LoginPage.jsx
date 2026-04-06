import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [otp, setOtp] = useState("");
  const {
    login,
    verifyLoginOtp,
    resendLoginOtp,
    cancelLoginOtpFlow,
    isLoggingIn,
    isVerifyingLoginOtp,
    isResendingLoginOtp,
    pendingLoginOtpEmail,
  } = useAuthStore();

  const isOtpStep = Boolean(pendingLoginOtpEmail);

  const handleSubmit = async (e) => {
    e.preventDefault();
    login(formData);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    await verifyLoginOtp(otp.trim());
  };

  const handleResendOtp = async () => {
    await resendLoginOtp();
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] grid lg:grid-cols-2 lg:overflow-hidden">
      {/* Left Side - Form */}
      <div className="flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center mb-4">
            <div className="flex flex-col items-center gap-2 group">
              <div
                className="w-12 h-12 flex items-center justify-center"
              >
                <img src="/lovinks.png" alt="Lovinks" className="w-10 h-10 object-contain" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Welcome Back</h1>
              <p className="text-base-content/60">Sign in to your account</p>
            </div>
          </div>

          {/* Form */}
          {!isOtpStep ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input
                    type="email"
                    className={`input input-bordered w-full pl-10`}
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Password</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`input input-bordered w-full pl-10`}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-base-content/40" />
                    ) : (
                      <Eye className="h-5 w-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              <p className="text-right text-sm text-base-content/60">
                <Link to="/forgot-password" className="link link-primary">
                  Forgot password?
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-lg border border-base-300 bg-base-200/40 p-3 text-sm text-base-content/80">
                OTP sent to <span className="font-semibold">{pendingLoginOtpEmail}</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Enter OTP</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full tracking-[0.28em] text-center"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isVerifyingLoginOtp || otp.trim().length !== 6}
              >
                {isVerifyingLoginOtp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </button>

              <div className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={cancelLoginOtpFlow}
                  disabled={isVerifyingLoginOtp || isResendingLoginOtp}
                >
                  Change Email
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleResendOtp}
                  disabled={isResendingLoginOtp || isVerifyingLoginOtp}
                >
                  {isResendingLoginOtp ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <div className="text-center">
            {!isOtpStep && (
              <p className="text-base-content/60">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="link link-primary">
                  Create account
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Image/Pattern */}
      <AuthImagePattern
        title={"Welcome back!"}
        subtitle={"Sign in to continue your conversations and catch up with your messages."}
      />
    </div>
  );
};
export default LoginPage;
