import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // SSR has no localStorage — skip and let the client guard run on hydration.
    if (typeof window === "undefined") return;

    // getUser() awaits the session restore from storage AND revalidates with
    // the Auth server. getSession() can race the hydration and return null
    // right after a hard navigation (e.g. post-OAuth), which would bounce a
    // signed-in user back to /login.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname + location.search },
      });
    }
  },
  component: () => <Outlet />,
});
