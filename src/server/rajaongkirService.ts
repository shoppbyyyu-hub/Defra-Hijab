// RajaOngkir Service with In-Memory Caching, Single-Flight Deduplication, and Quota Protection
// Designed to minimize API request consumption and prevent duplicate live calls

export interface RajaOngkirDestinationItem {
  id: number;
  label: string;
  subdistrict: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface JNEServiceOption {
  service: string;
  serviceCode: string;
  provider: 'JNE';
  description: string;
  cost: number;
  etd: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export type ShippingFailureCode = 'QUOTA_EXCEEDED' | 'INVALID_LOCATION' | 'AUTHENTICATION_FAILED' | 'NETWORK_ERROR' | 'NO_SUPPORTED_SERVICE' | 'UPSTREAM_ERROR';
type ShippingResult = { success: boolean; services?: JNEServiceOption[]; error?: string; code?: ShippingFailureCode; httpStatus?: number; fromCache?: boolean; isQuotaExceeded?: boolean };

// Configuration Constants
const DESTINATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days TTL
const SHIPPING_COST_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const MAX_CACHE_ENTRIES = 500;
const QUOTA_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown if quota limit is reached

// In-Memory Caches
const destinationCache = new Map<string, CacheEntry<RajaOngkirDestinationItem[]>>();
const costCache = new Map<string, CacheEntry<JNEServiceOption[]>>();
const knownDestinations = new Map<string, CacheEntry<RajaOngkirDestinationItem>>();

// In-Flight Promise Maps for Request Coalescing (Single-Flight)
const inFlightDestinations = new Map<string, Promise<{ success: boolean; destinations?: RajaOngkirDestinationItem[]; error?: string; isQuotaExceeded?: boolean; fromCache?: boolean }>>();
const inFlightCosts = new Map<string, Promise<ShippingResult>>();

function classifyShippingFailure(status: number, message: string): Pick<ShippingResult, 'code' | 'error' | 'httpStatus'> {
  if (status === 401 || status === 403) return { code: 'AUTHENTICATION_FAILED', httpStatus: status, error: 'Autentikasi RajaOngkir ditolak. Owner perlu memeriksa kredensial server.' };
  if ([400, 404, 422].includes(status)) return { code: 'INVALID_LOCATION', httpStatus: status, error: message || 'ID asal atau tujuan tidak valid untuk perhitungan tarif.' };
  return { code: 'UPSTREAM_ERROR', httpStatus: status, error: message || `Server RajaOngkir gagal merespons (HTTP ${status}).` };
}

// Circuit breaker state for quota exhaustion
let quotaExceededUntil = 0;
let lastQuotaErrorMessage = '';

// Optional mock fetch injector for testing without touching live API
let mockFetchHandler: ((url: string, init?: any) => Promise<any>) | null = null;

export function setMockFetch(handler: ((url: string, init?: any) => Promise<any>) | null) {
  mockFetchHandler = handler;
}

export function normalizeSearchQuery(query: string): string {
  return (query || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function rememberDestinations(destinations: RajaOngkirDestinationItem[]) {
  const timestamp = Date.now();
  for (const destination of destinations) {
    knownDestinations.set(String(destination.id), { data: destination, timestamp });
  }
  cleanExpiredEntries(knownDestinations, DESTINATION_TTL_MS);
}

/**
 * Resolve an origin only from a successful RajaOngkir search made by this
 * server. This prevents the admin settings endpoint from trusting a manually
 * typed ID or browser-supplied region labels.
 */
export function getKnownDestination(destinationId: string | number): RajaOngkirDestinationItem | null {
  const key = String(destinationId || '').trim();
  const entry = knownDestinations.get(key);
  if (!entry || Date.now() - entry.timestamp >= DESTINATION_TTL_MS) {
    if (entry) knownDestinations.delete(key);
    return null;
  }
  return { ...entry.data };
}

function cleanExpiredEntries<T>(cache: Map<string, CacheEntry<T>>, ttlMs: number) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > ttlMs) {
      cache.delete(key);
    }
  }
  // Enforce max size limit (FIFO eviction)
  if (cache.size > MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE_ENTRIES);
    for (const k of keysToDelete) {
      cache.delete(k);
    }
  }
}

function isQuotaExhaustedError(status: number, messageOrDescription?: string): boolean {
  if (status === 429) return true;
  if (!messageOrDescription) return false;
  const lower = messageOrDescription.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('kuota') ||
    lower.includes('limit') ||
    lower.includes('too many requests') ||
    lower.includes('habis')
  );
}

/**
 * Search RajaOngkir domestic destinations with 7-day server caching and single-flight deduplication.
 */
export async function searchDestinations(
  query: string,
  apiKey: string
): Promise<{ success: boolean; destinations?: RajaOngkirDestinationItem[]; error?: string; isQuotaExceeded?: boolean; fromCache?: boolean }> {
  const normalized = normalizeSearchQuery(query);
  if (!normalized || normalized.length < 3) {
    return { success: true, destinations: [], fromCache: true };
  }

  // Check quota circuit breaker
  if (Date.now() < quotaExceededUntil) {
    return {
      success: false,
      isQuotaExceeded: true,
      error: lastQuotaErrorMessage || 'Kuota harian API RajaOngkir telah habis. Silakan coba kembali nanti atau hubungi admin.'
    };
  }

  const cacheKey = `dest:${normalized}`;

  // 1. Check cache first
  const cached = destinationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DESTINATION_TTL_MS) {
    rememberDestinations(cached.data);
    return { success: true, destinations: cached.data, fromCache: true };
  }

  // 2. Single-flight coalescing: If identical request is currently in-flight, reuse promise
  const existingInFlight = inFlightDestinations.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  if (!apiKey || apiKey.trim() === '') {
    return { success: false, error: 'API Key RajaOngkir belum dikonfigurasi di file .env server.' };
  }

  // 3. Launch single live request
  const fetchPromise = (async () => {
    try {
      const url = `https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${encodeURIComponent(normalized)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const doFetch = mockFetchHandler || fetch;
      const response = await doFetch(url, {
        headers: { key: apiKey.trim() },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let json: any = null;
      let rawText = '';
      try {
        if (typeof response.json === 'function') {
          json = await response.json();
        }
      } catch {
        try {
          if (typeof response.text === 'function') {
            rawText = await response.text();
          }
        } catch {}
      }

      // Check quota exhaustion
      const metaMessage = json?.meta?.message || json?.rajaongkir?.status?.description || rawText || '';
      if (isQuotaExhaustedError(response.status, metaMessage)) {
        quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
        lastQuotaErrorMessage = 'Kuota harian API RajaOngkir telah habis (Status 429 / Limit Reached).';
        return {
          success: false,
          isQuotaExceeded: true,
          error: lastQuotaErrorMessage
        };
      }

      if (response.ok && json?.data && Array.isArray(json.data)) {
        const destinations: RajaOngkirDestinationItem[] = json.data.map((item: any) => ({
          id: item.id,
          label: item.label,
          subdistrict: item.subdistrict_name || item.district_name || '',
          district: item.district_name || '',
          city: item.city_name || '',
          province: item.province_name || '',
          postalCode: item.zip_code || ''
        }));

        // Cache successful results for 7 days
        destinationCache.set(cacheKey, {
          data: destinations,
          timestamp: Date.now()
        });
        rememberDestinations(destinations);
        cleanExpiredEntries(destinationCache, DESTINATION_TTL_MS);

        return { success: true, destinations, fromCache: false };
      }

      // DO NOT cache failed responses as empty results
      return {
        success: false,
        error: metaMessage || 'Gagal mencari wilayah tujuan di RajaOngkir.'
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Koneksi pencarian wilayah ke RajaOngkir timeout.' };
      }
      return {
        success: false,
        error: `Kendala jaringan pencarian wilayah RajaOngkir: ${err.message || 'Network error'}`
      };
    } finally {
      // Clear in-flight marker immediately
      inFlightDestinations.delete(cacheKey);
    }
  })();

  inFlightDestinations.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Calculate JNE shipping costs with 15-minute server caching and single-flight deduplication.
 */
export async function calculateShippingCost(
  origin: string | number,
  destination: string | number,
  weightGrams: number,
  apiKey: string,
  allowLiveCall = true
): Promise<ShippingResult> {
  // Courier is strictly JNE
  const endpoint = 'komerce';
  const cacheKey = `cost:${endpoint}:${origin}:${destination}:${weightGrams}:jne`;

  // 1. Check cache first
  const cached = costCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SHIPPING_COST_TTL_MS) {
    return { success: true, services: cached.data, fromCache: true };
  }

  // If live call is disallowed (cache-only lookup), return not found
  if (!allowLiveCall) {
    return { success: false, code: 'UPSTREAM_ERROR', error: 'Tarif tidak ditemukan di cache server.' };
  }

  // Check quota circuit breaker
  if (Date.now() < quotaExceededUntil) {
    return {
      success: false,
      code: 'QUOTA_EXCEEDED',
      httpStatus: 429,
      isQuotaExceeded: true,
      error: lastQuotaErrorMessage || 'Kuota harian API RajaOngkir telah habis. Silakan coba kembali nanti.'
    };
  }

  // 2. Single-flight coalescing: If identical request is currently in-flight, reuse promise
  const existingInFlight = inFlightCosts.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  if (!apiKey || apiKey.trim() === '') {
    return { success: false, code: 'AUTHENTICATION_FAILED', httpStatus: 500, error: 'API Key RajaOngkir belum dikonfigurasi di server.' };
  }

  // 3. Launch single live request (targeted to Komerce endpoint without burning multi-cascade loops)
  const fetchPromise: Promise<ShippingResult> = (async () => {
    try {
      const body = new URLSearchParams();
      body.append('origin', String(origin));
      body.append('destination', String(destination));
      body.append('weight', String(weightGrams));
      body.append('courier', 'jne');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const doFetch = mockFetchHandler || fetch;
      const response = await doFetch('https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost', {
        method: 'POST',
        headers: {
          key: apiKey.trim(),
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: body.toString(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let json: any = null;
      let rawText = '';
      try {
        if (typeof response.json === 'function') {
          json = await response.json();
        }
      } catch {
        try {
          if (typeof response.text === 'function') {
            rawText = await response.text();
          }
        } catch {}
      }

      // Check quota exhaustion
      const metaMessage = json?.meta?.message || json?.rajaongkir?.status?.description || rawText || '';
      if (isQuotaExhaustedError(response.status, metaMessage)) {
        quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
        lastQuotaErrorMessage = 'Kuota harian API RajaOngkir telah habis (Status 429 / Limit Reached).';
        return {
          success: false,
          code: 'QUOTA_EXCEEDED',
          httpStatus: response.status,
          isQuotaExceeded: true,
          error: lastQuotaErrorMessage
        };
      }

      if (response.ok && json?.data && Array.isArray(json.data) && json.data.length > 0) {
        const allowedJneServices = new Map([
          ['REG', 'Reguler'],
          ['SS', 'Super Speed'],
          ['YES', 'Yakin Esok Sampai']
        ]);
        const services: JNEServiceOption[] = json.data
          .map((item: any) => ({ item, code: String(item.service || '').trim().toUpperCase() }))
          .filter(({ code }: { code: string }) => allowedJneServices.has(code))
          .map(({ item, code }: { item: any; code: string }) => ({
            service: `JNE ${code}`,
            serviceCode: code,
            provider: 'JNE' as const,
            description: allowedJneServices.get(code)!,
            cost: Number(item.cost) || 0,
            etd: item.etd
              ? item.etd.includes('Hari') || item.etd.includes('day')
                ? item.etd
                : `${item.etd} Hari`
              : 'Estimasi tidak tersedia'
          }));

        if (services.length === 0) {
          return { success: false, code: 'NO_SUPPORTED_SERVICE', httpStatus: 422, error: 'Rute ditemukan, tetapi tidak menyediakan layanan JNE REG, SS, atau YES.' };
        }

        // Cache successful results for 15 minutes
        costCache.set(cacheKey, {
          data: services,
          timestamp: Date.now()
        });
        cleanExpiredEntries(costCache, SHIPPING_COST_TTL_MS);

        return { success: true, services, fromCache: false };
      }

      // DO NOT cache failed responses
      return { success: false, ...classifyShippingFailure(response.status, metaMessage) };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, code: 'NETWORK_ERROR', error: 'Koneksi perhitungan ongkir ke RajaOngkir timeout.' };
      }
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: `Kendala jaringan RajaOngkir: ${err.message || 'Network error'}`
      };
    } finally {
      // Clear in-flight marker immediately
      inFlightCosts.delete(cacheKey);
    }
  })();

  inFlightCosts.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Inspection helper for testing cache behavior and statistics.
 */
export function getRajaOngkirCacheStats() {
  return {
    destinationCacheSize: destinationCache.size,
    costCacheSize: costCache.size,
    inFlightDestinationsCount: inFlightDestinations.size,
    inFlightCostsCount: inFlightCosts.size,
    isQuotaCircuitOpen: Date.now() < quotaExceededUntil
  };
}

/**
 * Invalidate shipping cost cache when store origin changes.
 */
export function invalidateShippingCostCache() {
  costCache.clear();
  inFlightCosts.clear();
}

/**
 * Reset all in-memory caches and circuit breaker state.
 */
export function resetRajaOngkirCache() {
  destinationCache.clear();
  knownDestinations.clear();
  costCache.clear();
  inFlightDestinations.clear();
  inFlightCosts.clear();
  quotaExceededUntil = 0;
  lastQuotaErrorMessage = '';
}
