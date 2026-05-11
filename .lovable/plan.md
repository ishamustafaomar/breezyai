## Goal
Make "Sign in" actually work. Users can create an account / log in with email+password or Google, and the builder (`/app`) requires authentication.

## What I'll build

1. **Enable Google OAuth** via Lovable Cloud's managed Google provider (no extra keys needed for the user).

2. **New `/login` route** (`src/routes/login.tsx`)
   - Tabs: Sign in / Sign up
   - Email + password form (uses `supabase.auth.signInWithPassword` / `signUp` with `emailRedirectTo: window.location.origin + "/app"`)
   - "Continue with Google" button (uses `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" })`)
   - Friendly errors via `sonner` toasts
   - Reuses existing design tokens + shadcn Input/Button
   - If already logged in, redirect to `/app`

3. **Protect `/app`** by converting it to a `_authenticated` layout pattern:
   - Add `src/routes/_authenticated.tsx` — `beforeLoad` checks `supabase.auth.getUser()`; if no user, `redirect({ to: "/login" })`
   - Move `src/routes/app.tsx` → `src/routes/_authenticated/app.tsx` (URL stays `/app`)

4. **Update site header** (`src/components/site-header.tsx`)
   - "Sign in" link → `/login` (instead of `/app`)
   - "Start building" stays → `/app` (gate will bounce unauth users to `/login`)
   - When logged in, show user email + "Sign out" button instead of Sign in / Start building
   - Uses a small `useAuth` hook subscribing to `supabase.auth.onAuthStateChange`

5. **No profiles table** — we're not storing extra user data right now, so just rely on `auth.users`. (If you later want usernames/avatars, we add a `profiles` table then.)

## Auth config
- Email/password enabled (Cloud default)
- Email auto-confirm: **off** (users get a verification email — standard, more secure)
- Google: enabled via managed credentials

## Files touched
- new: `src/routes/login.tsx`
- new: `src/routes/_authenticated.tsx`
- new: `src/hooks/use-auth.ts`
- moved: `src/routes/app.tsx` → `src/routes/_authenticated/app.tsx`
- edited: `src/components/site-header.tsx`

## Out of scope (ask if you want them)
- Password reset / "forgot password" flow
- User profiles table (display name, avatar)
- Saving each user's projects to the database (currently localStorage only)
