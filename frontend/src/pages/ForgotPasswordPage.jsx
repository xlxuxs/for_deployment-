import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { ErrorAlert } from "../components/ErrorAlert";

export function ForgotPasswordPage() {
  const { isAuthenticated, initializing } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!initializing && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to send password reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
        <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Password Reset</p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Check your email.</h1>
            <p className="mt-5 text-lg leading-8 text-teal-50">
              We've sent a password reset link to your email address. Click the link to create a new password.
            </p>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
            <div className="mb-8">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
              <h2 className="mt-5 text-2xl font-bold text-slate-950">Email sent</h2>
              <p className="mt-1 text-sm text-slate-600">Check your inbox for a password reset link.</p>
            </div>

            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-6">
              <p className="text-sm text-emerald-800">
                <strong>Email:</strong> {email}
              </p>
              <p className="text-xs text-emerald-700 mt-2">The link will expire in 1 hour.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600">Didn't receive the email?</p>
              <button
                onClick={() => setSuccess(false)}
                className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Try another email
              </button>
              <Link
                to="/login"
                className="block text-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen bg-slate-100 px-4 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:px-10">
      <section className="hidden items-center rounded-lg bg-teal-800 px-12 text-white shadow-soft lg:flex">
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">Password Reset</p>
          <h1 className="mt-5 text-5xl font-black leading-tight tracking-tight">Forgot your password?</h1>
          <p className="mt-5 text-lg leading-8 text-teal-50">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:pl-10">
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-8">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-700 text-sm font-black text-white">CP</span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">Reset password</h2>
            <p className="mt-1 text-sm text-slate-600">We'll email you a reset link.</p>
          </div>

          <ErrorAlert message={error} />

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={submitting}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <p className="text-sm text-slate-600">
              Remember your password?{" "}
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
