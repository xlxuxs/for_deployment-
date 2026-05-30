import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import ToastsProvider from "./components/Toasts";
import { PublicLandingPage } from "./pages/PublicLandingPage";
import { PublicPolicyAnalyticsPage } from "./pages/PublicPolicyAnalyticsPage";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/LoadingState";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { PolicyFormPage } from "./pages/PolicyFormPage";
import { PolicyAnalyticsPage } from "./pages/PolicyAnalyticsPage";
import { CitizenManagementPage } from "./pages/CitizenManagementPage";
import { CommentModerationPage } from "./pages/CommentModerationPage";
import { CommentModeratorsPage } from "./pages/CommentModeratorsPage";
import { TrendsDashboardPage } from "./pages/TrendsDashboardPage";
import { PlannerRequestsPage } from "./pages/PlannerRequestsPage";
import { CrossAnalyticsPage } from "./pages/CrossAnalyticsPage";
import { SmsTestingPage } from "./pages/SmsTestingPage";
import { MessagesPage } from "./pages/MessagesPage";
import { MessageDetailPage } from "./pages/MessageDetailPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import NotificationsDevTest from "./pages/NotificationsDevTest";
import { SettingsPage } from "./pages/SettingsPage";
import { PlannersListPage } from "./pages/PlannersListPage";
import { PlannerDetailPage } from "./pages/PlannerDetailPage";
import { PolicyDetailPage } from "./pages/PolicyDetailPage";
import { AssociateInvitationPage } from "./pages/AssociateInvitationPage";
import { DelegatedPoliciesPage } from "./pages/DelegatedPoliciesPage";
import { PendingInvitationsPage } from "./pages/PendingInvitationsPage";
// New pages for delegated and read‑only policy views
import { DelegatedPolicyDetailPage } from "./pages/DelegatedPolicyDetailPage";
import { ReadOnlyPolicyDetailPage } from "./pages/ReadOnlyPolicyDetailPage";
import { useI18n } from "./i18n/I18nProvider";

function ProtectedRoute({ roles }) {
  const { initializing, isAuthenticated, role } = useAuth();
  const location = useLocation();
  const { t } = useI18n();

  if (initializing) {
    return <LoadingState fullScreen label={t("Checking your session")} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          {t("Page not found")}
        </h1>
        <p className="mt-2 text-slate-600">
          {t("The page you are looking for is not part of this dashboard.")}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  if (location.pathname === "/") {
    return (
      <ToastsProvider>
        <PublicLandingPage />
      </ToastsProvider>
    );
  }

  return (
    <ToastsProvider>
      <Routes>
      <Route path="/public/policies/:id/analytics" element={<PublicPolicyAnalyticsPage />} />
      <Route path="/sms-studio" element={<SmsTestingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute roles={["planner", "comment_moderator", "admin"]} />}>
        <Route element={<AppShell />}>
          {/* ⚠️ IMPORTANT: Specific routes must come before generic ones ⚠️ */}
          {/* Delegated & read-only policy detail pages (specific) */}
          <Route
            path="/policies/:id/delegated"
            element={<DelegatedPolicyDetailPage />}
          />
          <Route
            path="/policies/:id/readonly"
            element={<ReadOnlyPolicyDetailPage />}
          />
          {/* Analytics (specific) */}
          <Route path="/policies/:id/analytics" element={<PolicyAnalyticsPage />} />
          {/* More specific policy routes */}
          <Route path="/policies/new" element={<PolicyFormPage mode="create" />} />
          <Route path="/policies/:id/edit" element={<PolicyFormPage mode="edit" />} />
          <Route path="/policies/:id" element={<PolicyDetailPage />} />
          <Route path="/policies" element={<PoliciesPage />} />

          {/* Associate routes */}
          <Route
            path="/associates/invitation/:associateId"
            element={<AssociateInvitationPage />}
          />
          <Route
            path="/associates/policies"
            element={<DelegatedPoliciesPage />}
          />
          <Route
            path="/associates/invitations"
            element={<PendingInvitationsPage />}
          />

          {/* Other common routes */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/analytics/cross" element={<CrossAnalyticsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:id" element={<MessageDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/dev/notifications-test" element={<NotificationsDevTest />} />

          {/* Comment moderation routes */}
          <Route element={<ProtectedRoute roles={["admin", "comment_moderator"]} />}>
            <Route path="/comments/pending" element={<CommentModerationPage />} />
          </Route>

          {/* Admin-only routes */}
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/planners" element={<PlannersListPage />} />
            <Route path="/planners/:id" element={<PlannerDetailPage />} />
            <Route path="/citizens" element={<CitizenManagementPage />} />
            <Route path="/planner-requests" element={<PlannerRequestsPage />} />
            <Route path="/comment-moderators" element={<CommentModeratorsPage />} />
            <Route path="/trends" element={<TrendsDashboardPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ToastsProvider>
  );
}
