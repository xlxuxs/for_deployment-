import { useEffect, useState } from "react";
import { userApi } from "../api/user";
import { useAuth } from "../auth/AuthContext";
import { ErrorAlert } from "../components/ErrorAlert";
import { PasswordField } from "../components/PasswordField";
import { showToast } from "../lib/toast";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { getErrorMessage } from "../lib/format";
import { z } from "zod";
import { useForm } from "react-hook-form";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [emailForm, setEmailForm] = useState({ newEmail: "", code: "" });
  const [loading, setLoading] = useState(!user);
  const [submitting, setSubmitting] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      setLoading(false);
    }
  }, [user]);

  async function run(key, action, message) {
    setSubmitting(key);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      try { if (message) showToast('success', message); } catch (e) {}
      await refreshUser();
    } catch (err) {
      setError(getErrorMessage(err, "Request failed"));
    } finally {
      setSubmitting("");
    }
  }

  const onPasswordSubmit = async (data) => {
    setError("");
    setNotice("");

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      setError(firstError.message);
      return;
    }

    try {
      setSubmitting("password");
      await userApi.changePassword(data.currentPassword, data.newPassword);
        setNotice("Password updated successfully.");
        try { showToast('success', 'Password updated successfully.'); } catch (e) {}
      reset();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to change password"));
    } finally {
      setSubmitting("");
    }
  };

  if (loading) return <LoadingState label="Loading settings" />;

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <PageHeader
          title="Settings"
          description="Manage your dashboard profile, contact verification, and password."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </p>
            <p className="mt-1 text-sm font-bold text-slate-950">{user?.email}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Role
            </p>
            <p className="mt-1 text-sm font-bold text-slate-950">{user?.role}</p>
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />
      {/* notices shown via global toasts */}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h3 className="text-lg font-bold text-slate-950">Profile</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your account identity and dashboard access.
          </p>
          <dl className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Email
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">{user?.email}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Role
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">{user?.role}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Password</h3>
          <p className="mt-1 text-sm text-slate-500">
            Update your login credentials securely.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit(onPasswordSubmit)}>
            <PasswordField
              label="Current password"
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />
            <PasswordField
              label="New password"
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
            <PasswordField
              label="Confirm new password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            <button disabled={submitting === "password"} type="submit" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
              {submitting === "password" ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Email change</h3>
          <p className="mt-1 text-sm text-slate-500">
            Request a verification code and confirm a new email address.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="new@email.com"
              value={emailForm.newEmail}
              onChange={(event) => setEmailForm((current) => ({ ...current, newEmail: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={submitting === "email-request"}
                type="button"
                onClick={() => run("email-request", () => userApi.requestEmailChange(emailForm.newEmail), "Verification code sent to the new email.")}
                className="rounded-xl border border-teal-200 px-4 py-2 text-sm font-bold text-teal-700 transition hover:bg-teal-50 disabled:opacity-50"
              >
                Send code
              </button>
            </div>
            <input
              placeholder="verification code"
              value={emailForm.code}
              onChange={(event) => setEmailForm((current) => ({ ...current, code: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <button
              disabled={submitting === "email-verify"}
              type="button"
              onClick={() => run("email-verify", () => userApi.verifyEmailChange(emailForm.code), "Email updated.")}
              className="w-fit rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800 disabled:opacity-50"
            >
              Verify email
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
