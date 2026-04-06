import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import AuthImagePattern from "../components/AuthImagePattern";
import { useAuthStore } from "../store/useAuthStore";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    requestPasswordResetOtp,
    resendPasswordResetOtp,
    resetPasswordWithOtp,
    cancelPasswordResetFlow,
    isRequestingPasswordResetOtp,
    isResendingPasswordResetOtp,
    isResettingPasswordWithOtp,
    pendingPasswordResetEmail,
  } = useAuthStore();

  const isOtpStep = Boolean(pendingPasswordResetEmail);
  const activeEmail = pendingPasswordResetEmail || email;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.trim();
  const normalizedNewPassword = newPassword.trim();
  const normalizedConfirmPassword = confirmPassword.trim();
  const isValidEmail = /\S+@\S+\.\S+/.test(normalizedEmail);

  const disableRequestOtp = useMemo(() => {
    return isRequestingPasswordResetOtp || !normalizedEmail || !isValidEmail;
  }, [isRequestingPasswordResetOtp, isValidEmail, normalizedEmail]);

  const disableResetSubmit = useMemo(() => {
    return (
      isResettingPasswordWithOtp ||
      normalizedOtp.length !== 6 ||
      normalizedNewPassword.length < 6 ||
      normalizedConfirmPassword.length < 6 ||
      normalizedNewPassword !== normalizedConfirmPassword
    );
  }, [
    isResettingPasswordWithOtp,
    normalizedConfirmPassword,
    normalizedNewPassword,
    normalizedOtp,
  ]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();

    if (!normalizedEmail) {
      toast.error("Email is required");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      toast.error("Invalid email format");
      return;
    }

    await requestPasswordResetOtp(normalizedEmail);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (normalizedNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (normalizedNewPassword !== normalizedConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const success = await resetPasswordWithOtp({
      otp: normalizedOtp,
      newPassword: normalizedNewPassword,
    });

    if (success) {
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/login");
    }
  };

  const handleStartOver = () => {
    cancelPasswordResetFlow();
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen pt-16 grid lg:grid-cols-2 lg:overflow-hidden">
      <div className="flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="relative text-center mb-8">
            <Link
              to="/login"
              className="btn btn-circle btn-sm absolute -top-1 right-0"
              aria-label="Close forgot password"
            >
              <X className="size-4" />
            </Link>
            <div className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src="/lovinks.png" alt="Lovinks" className="w-10 h-10 object-contain" />
              </div>
              <h1 className="text-2xl font-bold mt-2">Forgot Password</h1>
              <p className="text-base-content/60">
                {!isOtpStep
                  ? "Enter your email to receive a reset OTP"
                  : "Verify OTP and set your new password"}
              </p>
            </div>
          </div>

          {!isOtpStep ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
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
                    className="input input-bordered w-full pl-10"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={disableRequestOtp}>
                {isRequestingPasswordResetOtp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  "Send Reset OTP"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-lg border border-base-300 bg-base-200/40 p-3 text-sm text-base-content/80">
                Reset OTP sent to <span className="font-semibold">{activeEmail}</span>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">OTP</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full text-center font-medium tracking-[0.16em]"
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">New Password</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    className="input input-bordered w-full pl-10"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5 text-base-content/40" />
                    ) : (
                      <Eye className="h-5 w-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Confirm Password</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-base-content/40" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="input input-bordered w-full pl-10"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-base-content/40" />
                    ) : (
                      <Eye className="h-5 w-5 text-base-content/40" />
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={disableResetSubmit}>
                {isResettingPasswordWithOtp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </button>

              <div className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleStartOver}
                  disabled={isResettingPasswordWithOtp || isResendingPasswordResetOtp}
                >
                  Change Email
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={resendPasswordResetOtp}
                  disabled={isResettingPasswordWithOtp || isResendingPasswordResetOtp}
                >
                  {isResendingPasswordResetOtp ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    "Resend OTP"
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="text-center">
            <p className="text-base-content/60">
              Remember your password?{" "}
              <Link to="/login" className="link link-primary">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AuthImagePattern
        title="Recover your account"
        subtitle="We will send a one-time code to your email so only you can set a new password."
      />
    </div>
  );
};

export default ForgotPasswordPage;
