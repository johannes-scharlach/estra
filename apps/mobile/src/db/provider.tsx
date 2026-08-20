import { PowerSyncContext } from '@powersync/react';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import { connectPowerSync, disconnectPowerSync, powersync } from './system';

type AuthState = {
  session: Session | null;
  /** False until we know whether a stored session exists. */
  ready: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, ready: false });

export function useAuth() {
  return useContext(AuthContext);
}

export function SystemProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (session) {
      // Safe to call repeatedly; PowerSync ignores a connect while connected.
      void connectPowerSync();
    } else {
      void disconnectPowerSync();
    }
  }, [ready, session]);

  const auth = useMemo(() => ({ session, ready }), [session, ready]);

  return (
    <AuthContext.Provider value={auth}>
      <PowerSyncContext.Provider value={powersync}>{children}</PowerSyncContext.Provider>
    </AuthContext.Provider>
  );
}
