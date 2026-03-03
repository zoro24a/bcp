"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';
import { Profile } from '@/lib/types';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean; // This will now only reflect the initial session check
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading for session check
  const navigate = useNavigate();
  const profileFetchPromiseRef = useRef<Promise<void> | null>(null); // To prevent multiple profile fetches

  // Function to fetch profile and handle redirection
  const fetchUserProfileAndRedirect = useCallback(async (userId: string) => {
    // Prevent multiple simultaneous fetches for the same user
    if (profileFetchPromiseRef.current) {
      await profileFetchPromiseRef.current;
      return;
    }

    profileFetchPromiseRef.current = (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Supabase fetchProfile error:', error);
        showError('Failed to fetch profile: ' + error.message);
        setProfile(null);
        // Do not navigate to /login here, let ProtectedRoute handle it if user tries to access protected route
      } else if (data) {
        setProfile(data as Profile);
        // Redirect based on role if currently on '/' or '/login'
        if (window.location.pathname === '/' || window.location.pathname === '/login') {
          switch (data.role) {
            case 'student':
              navigate('/student/dashboard', { replace: true });
              break;
            case 'tutor':
              navigate('/tutor/dashboard', { replace: true });
              break;
            case 'hod':
              navigate('/hod/dashboard', { replace: true });
              break;
            case 'admin':
              navigate('/admin/dashboard', { replace: true });
              break;
            case 'principal':
              navigate('/principal/dashboard', { replace: true });
              break;
            case 'office':
              navigate('/office/dashboard', { replace: true });
              break;
            default:
              navigate('/', { replace: true });
          }
        }
      }
      profileFetchPromiseRef.current = null; // Clear the promise ref after completion
    })();

    await profileFetchPromiseRef.current; // Wait for the fetch to complete
  }, [navigate]);

  // Effect for initial session load and auth state changes
  useEffect(() => {
    const handleSession = async (currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false); // Initial session check is complete

      if (currentSession?.user) {
        // Only fetch profile if it's a new user or the profile hasn't been loaded yet
        if (!profile || profile.id !== currentSession.user.id) {
          fetchUserProfileAndRedirect(currentSession.user.id);
        } else {
          // If profile is already loaded and matches, ensure we are on the correct page
          // This handles cases where a user might manually navigate to '/' or '/login'
          // while already authenticated and having a profile.
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            switch (profile.role) {
              case 'student':
                navigate('/student/dashboard', { replace: true });
                break;
              case 'tutor':
                navigate('/tutor/dashboard', { replace: true });
                break;
              case 'hod':
                navigate('/hod/dashboard', { replace: true });
                break;
              case 'admin':
                navigate('/admin/dashboard', { replace: true });
                break;
              case 'principal':
                navigate('/principal/dashboard', { replace: true });
                break;
              case 'office':
                navigate('/office/dashboard', { replace: true });
                break;
              default:
                navigate('/', { replace: true });
            }
          }
        }
      } else {
        console.log("Supabase onAuthStateChange: Session is null. Clearing profile.");
        setProfile(null);
        // Do NOT navigate to /login here. The landing page is the default unauthenticated view.
        // ProtectedRoute will handle redirects to /login if a protected route is accessed.
      }
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error('Supabase getSession error:', error);
        showError(error.message);
        setLoading(false);
        return;
      }
      handleSession(initialSession);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        handleSession(currentSession);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfileAndRedirect, navigate, profile]); // Added profile to dependency array

  const signOut = async () => {
    console.log("Portal Logout: Initiating sign out process...");

    try {
      // 1. Safe Session Check: Pre-flight check to avoid unnecessary 403s
      const { data: { session: activeSession } } = await supabase.auth.getSession();

      if (activeSession) {
        // 2. Clear Server Session: Use 'local' scope for cleanest device-specific sign out
        const { error } = await supabase.auth.signOut({ scope: 'local' });

        if (error) {
          // 403 / "Auth session missing" is common if session already expired; we treat it as "done"
          if (error.status === 403 || error.message.includes("Auth session missing")) {
            console.warn("Portal Logout: Session already invalidated on server.");
          } else {
            console.error('Portal Logout: Supabase error:', error);
          }
        }
      }

      showSuccess('Logged out successfully!');
    } catch (err: any) {
      console.error('Portal Logout: Unexpected error during signOut:', err);
    } finally {
      // 3. PRODUCTION BEST PRACTICE: Guaranteed State Clear & Redirect
      // We clear client state and redirect in finally to ensure absolute reliability.

      setSession(null);
      setUser(null);
      setProfile(null);

      console.log("Portal Logout: Client state cleared. Redirecting to /login...");

      // 4. Robust Redirection: Support both React Router and hard fallback
      try {
        navigate("/login", { replace: true });

        // Fallback: If for any reason navigation doesn't happen within a short window,
        // (e.g. if the component is unmounting in a weird way), trigger a hard redirect.
        setTimeout(() => {
          if (window.location.pathname !== "/login") {
            console.warn("Portal Logout: Navigate failed to change path. Using window.location fallback.");
            window.location.href = "/login";
          }
        }, 100);
      } catch (redirectError) {
        console.error("Portal Logout: Navigate threw error, using hard fallback:", redirectError);
        window.location.href = "/login";
      }
    }
  };

  return (
    <SessionContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};