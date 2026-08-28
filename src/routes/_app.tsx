import { useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { Settings, AlertTriangle, LogOut, HelpCircle, ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAppExitGuard } from "@/hooks/use-app-exit-guard";
import { DeferredHandoverBanner } from "@/components/handover/deferred-handover-banner";
import { HandoverInterstitial } from "@/components/handover/handover-interstitial";
import { RaiseIncidentDialog } from "@/components/tasks/raise-incident-dialog";
import { usePlants } from "@/lib/readings/queries";
import { OfflineSyncProvider } from "@/lib/offline/offline-sync-context";
import { SyncStatusBadge, StaleSyncBanner } from "@/components/system/sync-status";
import { UpdateAvailableBanner } from "@/components/system/update-available-banner";
import { ForcedReverifyGate } from "@/components/system/forced-reverify-gate";
import { ThemeToggle } from "@/components/system/theme-toggle";
import { OnboardingTour, REPLAY_TOUR_EVENT } from "@/components/system/onboarding-tour";
import { DesktopSidebar, BottomNav } from "@/components/nav/app-nav";
import { notifyAssignedTask } from "@/lib/native/local-notifications";
import { useTasksBoard } from "@/lib/tasks/queries";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // Skip on the server: the Supabase session lives in localStorage, which
    // isn't available during SSR. Enforcement here is a UX convenience —
    // real protection is server-side (RLS + is_active_admin), see
    // supabase/migrations/*_phase2_auth.sql.
    if (typeof window === "undefined") return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});

const SIDEBAR_KEY = "rfl-sidebar-collapsed";

function AppShell() {
  const { profile, status } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inAdmin = pathname.startsWith("/admin");
  const isAdmin = profile?.role === "admin";
  const { data: plants } = usePlants();
  const scopedPlantId = isAdmin ? null : (profile?.plant_assigned ?? null);
  const { data: notificationTasks } = useTasksBoard(scopedPlantId ?? undefined);
  const notificationState = useRef<{ profileId: string; taskIds: Set<string> } | null>(null);
  const [raiseIncidentOpen, setRaiseIncidentOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Bug fix (Aug 2026): warns before an actual app exit (back past the
  // last screen, closing the tab) via the browser's own beforeunload
  // prompt — see the hook for why the earlier custom in-app dialog was
  // dropped.
  useAppExitGuard();

  // `beforeLoad` can only see the persisted Supabase session. It cannot tell
  // whether the corresponding profile is inactive or inaccessible by RLS, so
  // enforce that second part once AuthProvider has resolved it.
  useEffect(() => {
    if (status === "signed-out") navigate({ to: "/login", replace: true });
  }, [navigate, status]);

  useEffect(() => {
    if (status !== "signed-in" || !profile || !notificationTasks) return;
    const assignedTasks = notificationTasks.filter(
      (task) => task.assigned_user_id === profile.id && task.status !== "completed" && task.status !== "cancelled",
    );
    const taskIds = new Set(assignedTasks.map((task) => task.id));
    if (notificationState.current?.profileId !== profile.id) {
      notificationState.current = { profileId: profile.id, taskIds };
      return;
    }
    for (const task of assignedTasks) {
      if (!notificationState.current.taskIds.has(task.id)) void notifyAssignedTask(task.title);
    }
    notificationState.current = { profileId: profile.id, taskIds };
  }, [notificationTasks, profile, status]);

  // Read the persisted rail state after mount (a useState initializer that
  // touches localStorage hydration-mismatches).
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  if (status !== "signed-in" || !profile) return null;
  // FAB needs a concrete plant to raise an incident against — an admin with
  // no rostered plant falls back to the first plant rather than blocking.
  const incidentPlantId = scopedPlantId ?? plants?.[0]?.id;

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(SIDEBAR_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <OfflineSyncProvider>
      <div className="min-h-screen bg-surface text-foreground selection:bg-primary/20">
        {/* Admin has its own in-page tab navigation covering every section
            (see _app.admin.tsx) — the global rail would only ever show a
            single "Admin" item pointing back at the current page, so it's
            hidden here rather than left as dead chrome. */}
        {!inAdmin && (
          <DesktopSidebar
            collapsed={collapsed}
            onToggle={toggleSidebar}
            isAdmin={!!isAdmin}
            scopedPlantId={scopedPlantId}
          />
        )}

        <div
          className={cn(
            "transition-[padding] duration-200",
            !inAdmin && (collapsed ? "lg:pl-16" : "lg:pl-60"),
          )}
        >
          <Header isAdmin={!!isAdmin} inAdmin={inAdmin} name={profile?.name} />

          <main
            className={cn(
              "print-area mx-auto px-4 py-6 pb-28 sm:px-5 lg:px-8 lg:py-8 lg:pb-12",
              // Admin is a desktop-first workspace: it gets the full width.
              // Operator screens stay in a single readable column so a
              // one-handed round doesn't sprawl across a control-room monitor.
              inAdmin ? "max-w-[1600px]" : "max-w-md lg:max-w-3xl",
            )}
          >
            <div className="sticky top-16 z-30 -mx-4 lg:-mx-8">
              <StaleSyncBanner />
              <UpdateAvailableBanner />
              {!isAdmin && <DeferredHandoverBanner />}
            </div>
            <Outlet />
          </main>
        </div>

        {!isAdmin && (
          <>
            <ReportIssueFab onOpen={() => setRaiseIncidentOpen(true)} disabled={!incidentPlantId} />
            <BottomNav scopedPlantId={scopedPlantId} />
          </>
        )}

        {raiseIncidentOpen && incidentPlantId && (
          <RaiseIncidentDialog
            plantId={incidentPlantId}
            onClose={() => setRaiseIncidentOpen(false)}
          />
        )}

        <ForcedReverifyGate />
        {/* Rule 27/39: mandatory shift-start handover — blocks the app (no
            skip, no dismiss) until state.completed or state.deferredPending;
            gating is internal to HandoverInterstitial itself. */}
        {/* Admins are never rostered on a shift — they must not be trapped
            by the mandatory operator handover interstitial. */}
        {!isAdmin && <HandoverInterstitial />}
        <OnboardingTour />
        <Toaster position="top-center" />
      </div>
    </OfflineSyncProvider>
  );
}

function Header({ isAdmin, inAdmin, name }: { isAdmin: boolean; inAdmin: boolean; name?: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  // UX feedback, Aug 2026: "confirmation windows in important parts ...
  // e.g. logout action". Sign-out ends the session immediately — an
  // accidental tap shouldn't be able to knock an operator mid-round.
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  async function handleSignOut() {
    setConfirmSignOutOpen(false);
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Always navigate away, even if signOut() throws (e.g. offline) — the
      // local session/profile state has already been cleared by signOut(),
      // so staying on a protected route would just show a broken screen.
      navigate({ to: "/login" });
    }
  }

  return (
    <header className="sticky top-0 z-40 min-h-16 border-b border-border/80 bg-background/95 backdrop-blur-xl pt-safe print-hide">
      <div className="mx-auto flex h-16 items-center gap-3 px-4 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {inAdmin && (
            <Link
              to="/readings"
              aria-label="Back to app"
              title="Back to app"
              className="-ml-1 inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden text-sm font-medium lg:inline">App</span>
            </Link>
          )}
          <span className="truncate text-sm font-semibold tracking-tight">
            {name ?? "RFL Utility Log"}
          </span>
          {inAdmin && (
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground">
              Admin
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <SyncStatusBadge />
          <ThemeToggle className="hidden sm:inline-flex" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(REPLAY_TOUR_EVENT))}
            aria-label="Replay the getting-started walkthrough"
            title="Getting started"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          {isAdmin && !inAdmin && (
            <Link
              to="/admin"
              aria-label="Admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground lg:hidden"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setConfirmSignOutOpen(true)}
            disabled={signingOut}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">Sign out</span>
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmSignOutOpen}
        title="Sign out?"
        description="You'll need to sign back in to continue logging readings."
        confirmLabel="Sign out"
        destructive
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOutOpen(false)}
      />
    </header>
  );
}

function ReportIssueFab({ onOpen, disabled }: { onOpen: () => void; disabled: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 mx-auto max-w-md pb-safe lg:bottom-0 lg:right-0 lg:left-auto lg:mx-0 print-hide">
      <div className="pointer-events-auto flex justify-end px-4 pb-3 lg:pb-6 lg:pr-6">
        <Button
          size="fab"
          variant="destructive"
          aria-label="Report Issue"
          disabled={disabled}
          onClick={onOpen}
        >
          <AlertTriangle />
        </Button>
      </div>
    </div>
  );
}
