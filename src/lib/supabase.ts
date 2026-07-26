import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// `supabase.auth.signUp()` on the shared client above signs the newly created
// account IN — replacing whoever is currently logged into the admin UI. When
// staff create an account on someone else's behalf we sign up through this
// isolated client instead: it keeps its session in memory only, under its own
// storage key, so the admin's session is never touched.
let signUpClient: ReturnType<typeof createClient> | null = null;

export const getSignUpClient = () => {
  if (!signUpClient) {
    signUpClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'fm-admin-signup-only',
      },
    });
  }
  return signUpClient;
};

// Creates an Auth account for someone else without disturbing the current
// admin session. Returns the new user's id, or null when the email is already
// registered (the caller decides whether that's an error).
export const createAuthAccountForOther = async (
  email: string,
  password: string,
  metadata: Record<string, unknown> = {},
) => {
  const client = getSignUpClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    if (error.message.includes('User already registered')) return null;
    throw error;
  }

  // With email confirmation enabled, signing up an address that already exists
  // succeeds silently and returns an obfuscated user with no identities (this
  // is deliberate, to stop email enumeration). The id that comes back is not
  // usable, so treat it as "already registered" rather than writing against it.
  if (data?.user && (data.user.identities?.length ?? 0) === 0) return null;

  // Drop the in-memory session for the account we just made. `scope: 'local'`
  // clears it here without revoking the new user's own tokens.
  await client.auth.signOut({ scope: 'local' }).catch(() => {});

  return data?.user?.id ?? null;
};
