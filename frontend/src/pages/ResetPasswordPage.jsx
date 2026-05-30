import { useSearchParams, Navigate, Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { authApi } from "../api/auth";
import { ErrorAlert } from "../components/ErrorAlert";
import { PasswordField } from "../components/PasswordField";

export function ResetPasswordPage() {
  const { isAuthenticated, initializing } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!token) {
    return (
      <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
        <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Error</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Invalid link</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              This password reset link is missing or has expired. Please request a new one.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-rose-700 text-sm font-black text-white">!</span>
              <h2 className="mt-5 text-2xl font-bold text-slate-950">Invalid link</h2>
              <p className="mt-1 text-sm text-slate-600">The reset link is missing or expired.</p>
            </div>

            <div className="space-y-3">
              <Link
                to="/forgot-password"
                className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
              >
                Request new reset link
              </Link>
              <Link
                to="/login"
                className="block text-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
        <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Success</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Password reset!</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              Your password has been successfully reset. Sign in with your new password.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">✓</span>
              <h2 className="mt-5 text-2xl font-bold text-slate-950">Password reset</h2>
              <p className="mt-1 text-sm text-slate-600">Your password has been updated.</p>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
              <p className="text-sm text-emerald-800">
                You can now sign in with your new password.
              </p>
            </div>

            <Link
              to="/login"
              className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
            >
              Back to login
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
      <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Create new password</p>
          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Reset your password</h1>
          <p className="mt-5 text-lg leading-8 text-teal-50">
            Enter a strong new password. Make sure it's different from before.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">New password</h2>
            <p className="mt-1 text-sm text-slate-600">Create a strong password.</p>
          </div>

          <ErrorAlert message={error} />

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <PasswordField
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
              helperText="Minimum 6 characters"
            />

            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={submitting}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <p className="text-sm text-slate-600">
              <Link to="/login" className="font-bold text-teal-700 hover:underline">
                Back to login
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
