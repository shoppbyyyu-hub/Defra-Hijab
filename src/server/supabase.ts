import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | undefined;
let authClient: SupabaseClient | undefined;

function requiredUrl(): string {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error('Konfigurasi server SUPABASE_URL belum tersedia.');
  return value;
}

function publishableKey(): string {
  const candidates = [
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_SECRET_KEY
  ].map((value) => value?.trim()).filter(Boolean) as string[];
  const modern = candidates.find((value) => value.startsWith('sb_publishable_'));
  const legacy = candidates.find((value) => !value.startsWith('sb_secret_'));
  const value = modern || legacy;
  if (!value) throw new Error('Konfigurasi publishable key Supabase belum tersedia.');
  return value;
}

function backendSecretKey(): string {
  const candidates = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim()).filter(Boolean) as string[];
  const modern = candidates.find((value) => value.startsWith('sb_secret_'));
  const legacy = candidates.find((value) => !value.startsWith('sb_publishable_'));
  const value = modern || legacy;
  if (!value) {
    throw new Error('Backend membutuhkan SUPABASE_SECRET_KEY dengan prefix sb_secret_.');
  }
  return value;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(requiredUrl(), backendSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return serviceClient;
}

export function getSupabaseAuth(): SupabaseClient {
  if (!authClient) {
    authClient = createClient(requiredUrl(), publishableKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return authClient;
}

export async function assertOwner(accessToken: string) {
  const db = getSupabaseAdmin();
  const { data: authData, error: authError } = await db.auth.getUser(accessToken);
  if (authError || !authData.user) return null;
  const { data: profile, error } = await db.from('owner_profiles').select('role').eq('user_id', authData.user.id).maybeSingle();
  if (error || profile?.role !== 'OWNER') return null;
  return authData.user;
}

export function publicStorageUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('/')) return path;
  return getSupabaseAdmin().storage.from('catalog-media').getPublicUrl(path).data.publicUrl;
}
