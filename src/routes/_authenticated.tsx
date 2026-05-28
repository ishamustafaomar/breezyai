import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // SSR has no localStorage — skip and let the client guard run on hydration.
    if (typeof window === "undefined") return;

    // Read from local storage (sync after hydration). Do NOT call getUser()
    // here — that hits the network and a transient failure (offline, slow
    // network, expired-but-refreshable token mid-refresh) would bounce the
    // signed-in user back to /login. autoRefreshToken handles renewals
    // separately; if the refresh truly fails, onAuthStateChange will fire
    // SIGNED_OUT and the root listener will invalidate.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => <Outlet />,
});
