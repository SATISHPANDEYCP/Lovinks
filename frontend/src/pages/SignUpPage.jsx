import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { Link } from "react-router-dom";

import AuthImagePattern from "../components/AuthImagePattern";
import toast from "react-hot-toast";

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const otpInputRef = useRef(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const {
    signup,
    verifyLoginOtp,
    resendLoginOtp,
    cancelLoginOtpFlow,
    isSigningUp,
    isVerifyingLoginOtp,
    isResendingLoginOtp,
    pendingLoginOtpEmail,
  } = useAuthStore();

  const isOtpStep = Boolean(pendingLoginOtpEmail);
  const normalizedFullName = formData.fullName.trim();
  const normalizedEmail = formData.email.trim().toLowerCase();
  const normalizedPassword = formData.password.trim();
  const isSignupDisabled =
    isSigningUp ||
    !normalizedFullName ||
    !normalizedEmail ||
    !/\S+@\S+\.\S+/.test(normalizedEmail) ||
    !normalizedPassword;

  const validateForm = () => {
    if (!normalizedFullName) return toast.error("Full name is required");
    if (!normalizedEmail) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) return toast.error("Invalid email format");
    if (!normalizedPassword) return toast.error("Password is required");
    if (normalizedPassword.length < 6) return toast.error("Password must be at least 6 characters");

    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const success = validateForm();

    if (success === true) {
      signup({
        fullName: normalizedFullName,
        email: normalizedEmail,
        password: normalizedPassword,
      });
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    await verifyLoginOtp(otp.trim());
  };

  const handleResendOtp = async () => {
    await resendLoginOtp();
  };

  useEffect(() => {
    if (!isOtpStep) return;

    setOtp("");
    otpInputRef.current?.focus();
  }, [isOtpStep]);

  return (
    <div className="min-h-screen pt-16 grid lg:grid-cols-2">
      {/* left side */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* LOGO */}
          <div className="text-center mb-8">
            <div className="flex flex-col items-center gap-2 group">
              <div
                className="size-12 flex items-center justify-center"
              >
                <img src="/lovinks.png" alt="Lovinks" className="size-10 object-contain" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Create Account</h1>
              <p className="text-base-content/60">Get started with your free account</p>
            </div>
          </div>

          {!isOtpStep ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Full Name</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="size-5 text-base-content/40" />
                  </div>
                  <input
                    type="text"
                    className={`input input-bordered w-full pl-10`}
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Email</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="size-5 text-base-content/40" />
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
                    <Lock className="size-5 text-base-content/40" />
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
                      <EyeOff className="size-5 text-base-content/40" />
                    ) : (
                      <Eye className="size-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={isSignupDisabled}>
                {isSigningUp ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
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
                  ref={otpInputRef}
                  type="text"
                  className="input input-bordered w-full tracking-[0.28em] text-center"
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
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
                    <Loader2 className="size-5 animate-spin" />
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
                Already have an account?{" "}
                <Link to="/login" className="link link-primary">
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* right side */}

      <AuthImagePattern
        title="Join our community"
        subtitle="Connect with friends, share moments, and stay in touch with your loved ones."
      />
    </div>
  );
};
export default SignUpPage;
