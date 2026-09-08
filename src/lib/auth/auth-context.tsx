"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isFirebaseReady } from "@/lib/firebase/client";
import {
  mapAuthError,
  requestPasswordReset,
  signIn as signInRequest,
  signOutUser,
  subscribeToAuth,
} from "@/lib/auth/auth-service";
import { canAccess, hasRole, isAccountActive } from "@/lib/permissions/permission-service";
import { PUBLIC_PATHS } from "@/lib/auth/route-policy";
import type { AuthUser, SignInPayload, UserProfile } from "@/types/auth";
import type { AppRole, Permission } from "@/types/permissions";

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  firebaseReady: boolean;
  signIn: (payload: SignInPayload) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  can: (permission?: Permission | Permission[]) => boolean;
  hasRole: (role?: AppRole | AppRole[]) => boolean;
  isActive: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const firebaseReady = isFirebaseReady();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(firebaseReady);

  useEffect(() => {
    if (!firebaseReady) return;

    const unsubscribe = subscribeToAuth((nextUser, nextProfile) => {
      setUser(nextUser);
      setProfile(nextProfile);
      setLoading(false);
    });

    return unsubscribe;
  }, [firebaseReady]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      firebaseReady,
      async signIn(payload) {
        const session = await signInRequest(payload);
        setUser(session.user);
        setProfile(session.profile);
      },
      async resetPassword(email) {
        await requestPasswordReset(email);
      },
      async signOut() {
        await signOutUser();
        setUser(null);
        setProfile(null);
        router.push("/login");
        router.refresh();
      },
      can(permission) {
        return canAccess(profile, permission);
      },
      hasRole(role) {
        return hasRole(profile?.roles, role);
      },
      isActive: isAccountActive(profile?.status),
    }),
    [firebaseReady, loading, profile, router, user]
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthRedirector
        loading={loading}
        user={user}
        profile={profile}
        pathname={pathname}
      />
      {children}
    </AuthContext.Provider>
  );
}

function AuthRedirector({
  loading,
  user,
  profile,
  pathname,
}: {
  loading: boolean;
  user: AuthUser | null;
  profile: UserProfile | null;
  pathname: string;
}) {
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user && !profile && !isPublic) {
      router.replace("/login?reason=not-provisioned");
      return;
    }

    if (user && profile && !isAccountActive(profile.status) && !isPublic) {
      router.replace("/login?reason=inactive");
    }
  }, [isPublic, loading, pathname, profile, router, user]);

  return null;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider.");
  }
  return context;
}

export { mapAuthError };
