import { createClient } from '@supabase/supabase-js';

export type Retreat = {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  location: string;
  address: string;
  what_to_bring: string | null;
  payment_instructions: string | null;
  shirt_sizes: string[];
  instagram_handle: string | null;
  whatsapp_group_link: string | null;
  share_link: string;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  is_active: boolean;
};

export type Registration = {
  id: string;
  retreat_id: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string | null;
  parish: string;
  has_health_issue: boolean;
  health_issue_details: string | null;
  shirt_size: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  payment_status: 'pending' | 'link_sent' | 'paid';
  payment_link: string | null;
  whatsapp_group_link: string | null;
  registered_at: string;
  payment_confirmed_at: string | null;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'participant';
  created_at: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

type Session = {
  user: AuthUser;
};

type AuthStateCallback = (_event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void;

type QueryResult<T> = {
  data: T;
  error: Error | null;
};

type SelectBuilder<T> = {
  eq: (field: string, value: unknown) => SelectBuilder<T>;
  order: (field: string, options?: { ascending?: boolean }) => Promise<QueryResult<T[]>>;
  maybeSingle: () => Promise<QueryResult<T | null>>;
};

type UpdateBuilder<T> = {
  eq: (field: string, value: unknown) => Promise<QueryResult<T[]>>;
};

type DeleteBuilder<T> = {
  eq: (field: string, value: unknown) => Promise<QueryResult<T[]>>;
};

type TableApi<T extends Record<string, unknown>> = {
  select: (_columns?: string) => SelectBuilder<T>;
  insert: (values: Partial<T> | Array<Partial<T>>) => Promise<QueryResult<T[]>>;
  update: (values: Partial<T>) => UpdateBuilder<T>;
  delete: () => DeleteBuilder<T>;
};

type FromFunction = {
  (table: 'retreats'): TableApi<Retreat>;
  (table: 'registrations'): TableApi<Registration>;
  (table: 'profiles'): TableApi<Profile>;
  (table: string): TableApi<Record<string, unknown>>;
};

type SupabaseLike = {
  auth: {
    getSession: () => Promise<QueryResult<{ session: Session | null }>>;
    onAuthStateChange: (
      callback: AuthStateCallback
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<QueryResult<{ user: AuthUser | null }>>;
    signUp: (credentials: { email: string; password: string }) => Promise<QueryResult<{ user: AuthUser | null }>>;
    signOut: () => Promise<QueryResult<null>>;
  };
  from: FromFunction;
};

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSupabaseAdapter(): SupabaseLike {
  if (isSupabaseConfigured && supabaseUrl && supabaseAnonKey) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    return {
      auth: {
        getSession: async () => {
          const { data, error } = await client.auth.getSession();
          const session = data.session?.user
            ? {
                user: {
                  id: data.session.user.id,
                  email: data.session.user.email ?? '',
                },
              }
            : null;
          return { data: { session }, error: error ? new Error(error.message) : null };
        },
        onAuthStateChange: (callback) =>
          client.auth.onAuthStateChange((_event, session) => {
            const mappedSession = session?.user
              ? {
                  user: {
                    id: session.user.id,
                    email: session.user.email ?? '',
                  },
                }
              : null;
            callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', mappedSession);
          }),
        signInWithPassword: async ({ email, password }) => {
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          return {
            data: { user: data.user ? { id: data.user.id, email: data.user.email ?? email } : null },
            error: error ? new Error(error.message) : null,
          };
        },
        signUp: async ({ email, password }) => {
          const { data, error } = await client.auth.signUp({ email, password });
          return {
            data: { user: data.user ? { id: data.user.id, email: data.user.email ?? email } : null },
            error: error ? new Error(error.message) : null,
          };
        },
        signOut: async () => {
          const { error } = await client.auth.signOut();
          return { data: null, error: error ? new Error(error.message) : null };
        },
      },
      from: ((table: string) => client.from(table) as unknown as TableApi<Record<string, unknown>>) as FromFunction,
    };
  }

  type LocalUser = { id: string; email: string; password: string };

  const LOCAL_AUTH_USERS_KEY = 'local-auth-users';
  const LOCAL_AUTH_CURRENT_KEY = 'local-auth-current-user';
  const LOCAL_RETREATS_KEY = 'local-retreats';
  const LOCAL_REGISTRATIONS_KEY = 'local-registrations';
  const LOCAL_PROFILES_KEY = 'local-profiles';

  const listeners = new Set<AuthStateCallback>();

  const read = <T,>(key: string, fallback: T): T => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const write = <T,>(key: string, value: T) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  const seedLocalData = () => {
    const users = read<LocalUser[]>(LOCAL_AUTH_USERS_KEY, []);
    if (users.length === 0) {
      const defaultUser: LocalUser = {
        id: createId(),
        email: 'admin@local.com',
        password: '123456',
      };
      write(LOCAL_AUTH_USERS_KEY, [defaultUser]);
      write<Profile[]>(LOCAL_PROFILES_KEY, [
        {
          id: defaultUser.id,
          email: defaultUser.email,
          full_name: 'Administrador Local',
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      ]);
    }

    const retreats = read<Retreat[]>(LOCAL_RETREATS_KEY, []);
    if (retreats.length === 0) {
      write<Retreat[]>(LOCAL_RETREATS_KEY, [
        {
          id: createId(),
          name: 'Retiro Local de Exemplo',
          date: new Date().toISOString(),
          end_date: new Date().toISOString(),
          location: 'Centro de Formacao',
          address: 'Rua Exemplo, 100 - Cidade',
          what_to_bring: 'Biblia, caderno e garrafa de agua',
          payment_instructions: null,
          shirt_sizes: ['P', 'M', 'G', 'GG'],
          instagram_handle: '@retiro.local',
          whatsapp_group_link: null,
          share_link: 'local-demo-link',
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
      ]);
    }
  };

  seedLocalData();

  const getCurrentSession = (): Session | null => {
    const currentUserId = window.localStorage.getItem(LOCAL_AUTH_CURRENT_KEY);
    if (!currentUserId) return null;
    const users = read<LocalUser[]>(LOCAL_AUTH_USERS_KEY, []);
    const user = users.find((item) => item.id === currentUserId);
    if (!user) return null;
    return { user: { id: user.id, email: user.email } };
  };

  const notify = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => {
    listeners.forEach((listener) => listener(event, session));
  };

  const createSelectBuilder = <T extends Record<string, unknown>>(rows: T[]): SelectBuilder<T> => {
    let filtered = [...rows];
    return {
      eq: (field, value) => {
        filtered = filtered.filter((row) => row[field as keyof T] === value);
        return createSelectBuilder(filtered);
      },
      order: async (field, options) => {
        const ascending = options?.ascending ?? true;
        const sorted = [...filtered].sort((left, right) => {
          const a = left[field];
          const b = right[field];
          if (a === b) return 0;
          if (a === undefined || a === null) return ascending ? -1 : 1;
          if (b === undefined || b === null) return ascending ? 1 : -1;
          return String(a).localeCompare(String(b)) * (ascending ? 1 : -1);
        });
        return { data: sorted, error: null };
      },
      maybeSingle: async () => {
        return { data: filtered[0] ?? null, error: null };
      },
    };
  };

  const fromLocal = ((table: string) => {
    if (table === 'retreats') {
      const api: TableApi<Retreat> = {
        select: () => createSelectBuilder(read<Retreat[]>(LOCAL_RETREATS_KEY, [])),
        insert: async (values) => {
          const retreats = read<Retreat[]>(LOCAL_RETREATS_KEY, []);
          const payloads = Array.isArray(values) ? values : [values];
          const inserted = payloads.map((item) => ({
            id: createId(),
            name: String(item.name ?? 'Retiro sem nome'),
            date: String(item.date ?? new Date().toISOString()),
            end_date: (item.end_date ?? null) as string | null,
            location: String(item.location ?? ''),
            address: String(item.address ?? ''),
            what_to_bring: (item.what_to_bring ?? null) as string | null,
            payment_instructions: (item.payment_instructions ?? null) as string | null,
            shirt_sizes: (item.shirt_sizes as string[] | undefined) ?? ['P', 'M', 'G'],
            instagram_handle: (item.instagram_handle ?? null) as string | null,
            whatsapp_group_link: (item.whatsapp_group_link ?? null) as string | null,
            share_link: String(item.share_link ?? createId()),
            created_by: (item.created_by ?? null) as string | null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: item.is_active ?? true,
          }));
          write<Retreat[]>(LOCAL_RETREATS_KEY, [...retreats, ...inserted]);
          return { data: inserted, error: null };
        },
        update: (values) => ({
          eq: async (field, value) => {
            const retreats = read<Retreat[]>(LOCAL_RETREATS_KEY, []);
            const updated = retreats.map((row) =>
              row[field as keyof Retreat] === value
                ? ({ ...row, ...values, updated_at: new Date().toISOString() } as Retreat)
                : row
            );
            write<Retreat[]>(LOCAL_RETREATS_KEY, updated);
            return {
              data: updated.filter((row) => row[field as keyof Retreat] === value),
              error: null,
            };
          },
        }),
        delete: () => ({
          eq: async (field, value) => {
            const retreats = read<Retreat[]>(LOCAL_RETREATS_KEY, []);
            const toDelete = retreats.filter((row) => row[field as keyof Retreat] === value);
            const remaining = retreats.filter((row) => row[field as keyof Retreat] !== value);
            write<Retreat[]>(LOCAL_RETREATS_KEY, remaining);

            // Simulate FK cascade for local mode: remove registrations of deleted retreats.
            if (toDelete.length > 0) {
              const deletedIds = new Set(toDelete.map((row) => row.id));
              const registrations = read<Registration[]>(LOCAL_REGISTRATIONS_KEY, []);
              const remainingRegistrations = registrations.filter(
                (row) => !deletedIds.has(row.retreat_id)
              );
              write<Registration[]>(LOCAL_REGISTRATIONS_KEY, remainingRegistrations);
            }

            return { data: toDelete, error: null };
          },
        }),
      };
      return api as TableApi<Record<string, unknown>>;
    }

    if (table === 'registrations') {
      const api: TableApi<Registration> = {
        select: () => createSelectBuilder(read<Registration[]>(LOCAL_REGISTRATIONS_KEY, [])),
        insert: async (values) => {
          const registrations = read<Registration[]>(LOCAL_REGISTRATIONS_KEY, []);
          const payloads = Array.isArray(values) ? values : [values];
          const inserted = payloads.map((item) => ({
            id: createId(),
            retreat_id: String(item.retreat_id ?? ''),
            full_name: String(item.full_name ?? ''),
            phone: String(item.phone ?? ''),
            email: String(item.email ?? ''),
            date_of_birth: (item.date_of_birth ?? null) as string | null,
            parish: String(item.parish ?? ''),
            has_health_issue: Boolean(item.has_health_issue),
            health_issue_details: (item.health_issue_details ?? null) as string | null,
            shirt_size: String(item.shirt_size ?? ''),
            emergency_contact_name: String(item.emergency_contact_name ?? ''),
            emergency_contact_phone: String(item.emergency_contact_phone ?? ''),
            payment_status: item.payment_status ?? 'pending',
            payment_link: (item.payment_link ?? null) as string | null,
            whatsapp_group_link: (item.whatsapp_group_link ?? null) as string | null,
            registered_at: new Date().toISOString(),
            payment_confirmed_at: (item.payment_confirmed_at ?? null) as string | null,
          }));
          write<Registration[]>(LOCAL_REGISTRATIONS_KEY, [...registrations, ...inserted]);
          return { data: inserted, error: null };
        },
        update: (values) => ({
          eq: async (field, value) => {
            const registrations = read<Registration[]>(LOCAL_REGISTRATIONS_KEY, []);
            const updated = registrations.map((row) =>
              row[field as keyof Registration] === value
                ? ({ ...row, ...values } as Registration)
                : row
            );
            write<Registration[]>(LOCAL_REGISTRATIONS_KEY, updated);
            return {
              data: updated.filter((row) => row[field as keyof Registration] === value),
              error: null,
            };
          },
        }),
        delete: () => ({
          eq: async (field, value) => {
            const registrations = read<Registration[]>(LOCAL_REGISTRATIONS_KEY, []);
            const toDelete = registrations.filter((row) => row[field as keyof Registration] === value);
            const remaining = registrations.filter((row) => row[field as keyof Registration] !== value);
            write<Registration[]>(LOCAL_REGISTRATIONS_KEY, remaining);
            return { data: toDelete, error: null };
          },
        }),
      };
      return api as TableApi<Record<string, unknown>>;
    }

    const api: TableApi<Profile> = {
      select: () => createSelectBuilder(read<Profile[]>(LOCAL_PROFILES_KEY, [])),
      insert: async (values) => {
        const profiles = read<Profile[]>(LOCAL_PROFILES_KEY, []);
        const payloads = Array.isArray(values) ? values : [values];
        const inserted = payloads.map((item) => ({
          id: String(item.id ?? createId()),
          email: String(item.email ?? ''),
          full_name: (item.full_name ?? null) as string | null,
          role: item.role ?? 'admin',
          created_at: new Date().toISOString(),
        }));
        write<Profile[]>(LOCAL_PROFILES_KEY, [...profiles, ...inserted]);
        return { data: inserted, error: null };
      },
      update: (values) => ({
        eq: async (field, value) => {
          const profiles = read<Profile[]>(LOCAL_PROFILES_KEY, []);
          const updated = profiles.map((row) =>
            row[field as keyof Profile] === value ? ({ ...row, ...values } as Profile) : row
          );
          write<Profile[]>(LOCAL_PROFILES_KEY, updated);
          return {
            data: updated.filter((row) => row[field as keyof Profile] === value),
            error: null,
          };
        },
      }),
      delete: () => ({
        eq: async (field, value) => {
          const profiles = read<Profile[]>(LOCAL_PROFILES_KEY, []);
          const toDelete = profiles.filter((row) => row[field as keyof Profile] === value);
          const remaining = profiles.filter((row) => row[field as keyof Profile] !== value);
          write<Profile[]>(LOCAL_PROFILES_KEY, remaining);
          return { data: toDelete, error: null };
        },
      }),
    };
    return api as TableApi<Record<string, unknown>>;
  }) as FromFunction;

  const localAdapter: SupabaseLike = {
    auth: {
      getSession: async () => ({ data: { session: getCurrentSession() }, error: null }),
      onAuthStateChange: (callback) => {
        listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => listeners.delete(callback),
            },
          },
        };
      },
      signInWithPassword: async ({ email, password }) => {
        const users = read<LocalUser[]>(LOCAL_AUTH_USERS_KEY, []);
        const found = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
        if (!found || found.password !== password) {
          return { data: { user: null }, error: new Error('Email ou senha invalidos') };
        }
        window.localStorage.setItem(LOCAL_AUTH_CURRENT_KEY, found.id);
        const session = { user: { id: found.id, email: found.email } };
        notify('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      },
      signUp: async ({ email, password }) => {
        const users = read<LocalUser[]>(LOCAL_AUTH_USERS_KEY, []);
        const exists = users.some((item) => item.email.toLowerCase() === email.toLowerCase());
        if (exists) {
          return { data: { user: null }, error: new Error('Este email ja esta cadastrado') };
        }
        const newUser: LocalUser = { id: createId(), email, password };
        write<LocalUser[]>(LOCAL_AUTH_USERS_KEY, [...users, newUser]);
        window.localStorage.setItem(LOCAL_AUTH_CURRENT_KEY, newUser.id);
        const session = { user: { id: newUser.id, email: newUser.email } };
        notify('SIGNED_IN', session);
        return { data: { user: session.user }, error: null };
      },
      signOut: async () => {
        window.localStorage.removeItem(LOCAL_AUTH_CURRENT_KEY);
        notify('SIGNED_OUT', null);
        return { data: null, error: null };
      },
    },
    from: fromLocal,
  };

  return localAdapter;
}

export const supabase: SupabaseLike = createSupabaseAdapter();
