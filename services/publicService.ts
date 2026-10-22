import { api } from './api';
import type { Breed, LandingData, PublicConfig } from './types';

let configCache: Promise<PublicConfig> | null = null;
let breedsCache: Promise<Breed[]> | null = null;

export const publicService = {
  config(): Promise<PublicConfig> {
    configCache ??= api.get<{ data: PublicConfig }>('/public/config').then((r) => r.data);
    configCache.catch(() => (configCache = null));
    return configCache;
  },

  landing: () => api.get<{ data: LandingData }>('/public/landing').then((r) => r.data),

  breeds(): Promise<Breed[]> {
    breedsCache ??= api.get<{ data: Breed[] }>('/breeds').then((r) => r.data);
    breedsCache.catch(() => (breedsCache = null));
    return breedsCache;
  },

  clearBreedsCache: () => {
    breedsCache = null;
  },
};
