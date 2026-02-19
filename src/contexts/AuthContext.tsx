import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, Profile, AuthUser, isSupabaseConfigured } from '../lib/supabase';

type AuthContextType = {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ pendingApproval: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const primaryAdminEmails = ['robson.rossetto14@gmail.com', 'robsonrossetto2015@gmail.com'];
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const canonicalizeEmail = (value: string) => {
    const normalized = normalizeEmail(value);
    const [localPartRaw, domainRaw] = normalized.split('@');
    const localPart = localPartRaw ?? '';
    const domain = domainRaw ?? '';
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      const withoutAlias = localPart.split('+')[0].replace(/\./g, '');
      return `${withoutAlias}@gmail.com`;
    }
    return normalized;
  };
  const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string, email?: string) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && isSupabaseConfigured) {
        console.error('Error loading profile:', error);
      }

      // If authenticated user exists but profile row is missing,
      // create it to prevent login loops on fresh Supabase projects.
      if (!data && email) {
        const normalizedEmail = normalizeEmail(email);
        const isPrimaryAdmin = primaryAdminEmails.some(
          (adminEmail) => canonicalizeEmail(normalizedEmail) === canonicalizeEmail(adminEmail),
        );
        const { error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: normalizedEmail,
            full_name: null,
            role: isPrimaryAdmin ? 'admin' : 'participant',
            approval_status: isPrimaryAdmin ? 'approved' : 'pending',
            approved_at: isPrimaryAdmin ? new Date().toISOString() : null,
          });

        if (createError && isSupabaseConfigured) {
          const message = createError.message.toLowerCase();
          if (!message.includes('duplicate') && !message.includes('unique')) {
            console.error('Error creating missing profile:', createError);
          }
        }

        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        data = retry.data ?? null;
      }

      setProfile(data || null);
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const isPrimaryAdmin = primaryAdminEmails.some(
        (adminEmail) => canonicalizeEmail(normalizedEmail) === canonicalizeEmail(adminEmail),
      );

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (isPrimaryAdmin && !profileData) {
        const createPrimaryAdmin = await supabase.from('profiles').insert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: null,
          role: 'admin',
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
        });
        if (!createPrimaryAdmin.error) return;
      }

      if (isPrimaryAdmin && profileData && (profileData.approval_status !== 'approved' || profileData.role !== 'admin')) {
        const autoApprove = await supabase
          .from('profiles')
          .update({
            role: 'admin',
            approval_status: 'approved',
            approved_at: new Date().toISOString(),
          })
          .eq('id', data.user.id);
        if (!autoApprove.error) return;
      }

      if (!isPrimaryAdmin && (!profileData || profileData.approval_status !== 'approved')) {

        await supabase.auth.signOut();
        throw new Error('Sua conta está aguardando aprovação do administrador.');
      }
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    if (data.user) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      let { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: fullName,
          role: 'participant',
          approval_status: 'pending',
          approved_at: null,
        });

      const profileMessage = profileError?.message?.toLowerCase() ?? '';
      if (profileError && (profileMessage.includes('duplicate') || profileMessage.includes('unique'))) {
        const updateExisting = await supabase
          .from('profiles')
          .update({
            email: normalizedEmail,
            full_name: fullName,
            role: 'participant',
            approval_status: 'pending',
            approved_at: null,
          })
          .eq('id', data.user.id);
        profileError = updateExisting.error;
      }

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/request-account-approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.VITE_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY ?? ''}`,
        },
        body: JSON.stringify({
          userId: data.user.id,
          email: normalizedEmail,
          fullName,
        }),
      }).catch((requestError) => {
        console.error('Failed to request account approval email', requestError);
      });

      await supabase.auth.signOut();
      return { pendingApproval: true };
    }

    return { pendingApproval: true };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
