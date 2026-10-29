import { MOCK_POSTS } from '../data/mockPosts';
import { MOCK_TRENDING_LOOKS } from '../data/mockTrending';
import { MOCK_FOR_YOU } from '../data/mockForYou';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import { MOCK_SAVED_TRYONS } from '../data/mockTryOns';
import { CURRENT_USER } from '../data/mockUsers';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

let authTokenGetter = null;

/**
 * Register a token getter callback (typically from Clerk useAuth().getToken).
 */
export function setAuthTokenGetter(fn) {
  authTokenGetter = fn;
}

export async function getAuthToken() {
  if (typeof authTokenGetter === 'function') {
    try {
      return await authTokenGetter();
    } catch (err) {
      console.warn('[FitsYou Auth] Could not retrieve token from registered getter:', err);
      return null;
    }
  }
  return null;
}

async function safeFetch(url, options = {}) {
  try {
    const token = await getAuthToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorMsg = `API Error: ${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        errorMsg = errJson.message || errJson.error || errorMsg;
      } catch (_) {}

      if (!USE_MOCKS) {
        const error = new Error(errorMsg);
        error.status = res.status;
        throw error;
      }

      console.warn(`[FitsYou API Warning] ${res.status} on ${url}: ${errorMsg}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    if (!USE_MOCKS) {
      console.error(`[FitsYou API Error] ${options.method || 'GET'} ${url} failed:`, err.message);
      throw err;
    }

    console.warn(`[FitsYou API Fallback] ${options.method || 'GET'} ${url} unreachable (${err.message}). Using local cache/mock data.`);
    return null;
  }
}

export const api = {
  // 1. Social Feed Posts
  async getPosts({ tab = 'all', category = '', q = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (tab && tab !== 'all') params.set('tab', tab);
    if (category) params.set('category', category);
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/posts?${params.toString()}`);
    if (data) return data;

    if (USE_MOCKS) {
      return {
        posts: MOCK_POSTS,
        pagination: { total: MOCK_POSTS.length, page: 1, limit: MOCK_POSTS.length, hasMore: false },
      };
    }
    return { posts: [], pagination: { total: 0, page: 1, limit, hasMore: false } };
  },

  async getPostById(id) {
    const data = await safeFetch(`/api/v1/posts/${id}`);
    if (data) return data;
    if (USE_MOCKS) return MOCK_POSTS.find((p) => p.id === id) || null;
    return null;
  },

  async createPost(postData) {
    return await safeFetch('/api/v1/posts', {
      method: 'POST',
      body: JSON.stringify(postData),
    });
  },

  async deletePost(postId) {
    return await safeFetch(`/api/v1/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  async toggleLike(postId) {
    const data = await safeFetch(`/api/v1/posts/${postId}/like`, {
      method: 'POST',
    });
    return data;
  },

  async getComments(postId) {
    const data = await safeFetch(`/api/v1/posts/${postId}/comments`);
    return data?.comments || [];
  },

  async addComment(postId, text) {
    const data = await safeFetch(`/api/v1/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return data?.comment || null;
  },

  // 2. Trending Outfits & Ranking
  async getTrending({ category = 'all', q = '', limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (q) params.set('q', q);
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/trending?${params.toString()}`);
    if (data && data.trendingLooks) {
      return data.trendingLooks;
    }
    if (USE_MOCKS) return MOCK_TRENDING_LOOKS;
    return [];
  },

  // 3. For-You AI Recommendations
  async getForYou({ category = 'all', q = '', limit = 20, forceRefresh = false, refresh = false } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    if (q) params.set('q', q);
    if (forceRefresh || refresh) params.set('refresh', 'true');
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/for-you?${params.toString()}`);
    if (data && data.outfits) {
      return {
        forYouFeed: data.outfits,
        styleProfile: data.userProfile || MOCK_FOR_YOU.styleProfile,
        curatedGarments: data.outfits.slice(0, 4).map((o) => o.defaultGarment || o.garments?.[0]),
        cached: data.cached,
        isStarter: data.isStarter,
        isStale: data.isStale,
      };
    }
    if (USE_MOCKS) return MOCK_FOR_YOU;
    return { forYouFeed: [], styleProfile: null, curatedGarments: [], cached: false, isStarter: false, isStale: false };
  },

  // 4. Products & Catalog
  async getProducts({ q = '', category = '', audience = '', minPrice, maxPrice, page = 1, limit = 20, wearableOnly } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (audience) params.set('audience', audience);
    if (minPrice !== undefined) params.set('minPrice', String(minPrice));
    if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
    if (wearableOnly !== undefined && wearableOnly !== null) params.set('wearableOnly', String(wearableOnly));
    params.set('page', String(page));
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/products?${params.toString()}`);
    if (data && data.products) {
      return data;
    }
    if (USE_MOCKS) {
      return {
        products: MOCK_PRODUCTS,
        pagination: { total: MOCK_PRODUCTS.length, page: 1, limit: MOCK_PRODUCTS.length, hasMore: false },
      };
    }
    return { products: [], pagination: { total: 0, page: 1, limit, hasMore: false } };
  },

  async getProductById(id) {
    const data = await safeFetch(`/api/v1/products/${id}`);
    if (data) return data;
    if (USE_MOCKS) return MOCK_PRODUCTS.find((p) => p.id === id || p.id === `prod-${id}`) || null;
    return null;
  },

  async getProductFit(id, queryParams = {}) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v));
      }
    });
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await safeFetch(`/api/v1/products/${id}/fit${qs}`);
  },

  // 5. Virtual Try-On Pipeline
  async submitTryOn({ productId, userPhotoUrl, userHeightCm, sizeSelected = 'M' }) {
    const numProductId = typeof productId === 'string' ? parseInt(productId.replace(/\D/g, ''), 10) || 392 : productId;
    return await safeFetch('/api/v1/try-on', {
      method: 'POST',
      body: JSON.stringify({
        productId: numProductId,
        userPhotoUrl,
        userHeightCm,
        sizeSelected,
      }),
    });
  },

  async pollTryOnJob(jobId) {
    return await safeFetch(`/api/v1/try-on/jobs/${jobId}`);
  },

  /**
   * Polls job status until it resolves on COMPLETED or throws on FAILED, timeout, or network error.
   */
  async waitForJob(jobId, { intervalMs = 2000, timeoutMs = 120000, onProgress } = {}) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/api/v1/try-on/jobs/${jobId}`, {
        headers: authHeaders,
      });

      if (!res.ok) {
        let errMsg = `Server error ${res.status}: ${res.statusText}`;
        try {
          const errJson = await res.json();
          errMsg = errJson.message || errJson.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const job = await res.json();

      if (onProgress && typeof onProgress === 'function') {
        onProgress(job);
      }

      if (job.status === 'COMPLETED') {
        return job;
      }

      if (job.status === 'FAILED') {
        throw new Error(job.errorMessage || 'Virtual try-on generation failed.');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Try-on job timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
  },

  async getTryOnSessions({ page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/try-on/sessions?${params.toString()}`);
    if (data && data.sessions) {
      return data.sessions;
    }
    if (USE_MOCKS) return MOCK_SAVED_TRYONS;
    return [];
  },

  async updateTryOnSession(id, updates) {
    return await safeFetch(`/api/v1/try-on/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // 6. User Profile, Current User, & Body Profile
  async getCurrentUser() {
    return await safeFetch('/api/v1/users/me');
  },

  async getUserProfile(id = 'me') {
    const data = await safeFetch(`/api/v1/users/${id}`);
    if (data) return data;
    if (USE_MOCKS) return CURRENT_USER;
    return null;
  },

  async updateBodyProfile(profileData, userId = 'me') {
    return await safeFetch(`/api/v1/users/${userId}/body-profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // 7. Consent & Photos (A2 & Phase 3 Onboarding)
  async giveConsent(type = 'photo_processing') {
    return await safeFetch('/api/v1/me/consent', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  async getPhotoUploadUrl({ filename = 'user_photo.jpg', contentType = 'image/jpeg' } = {}) {
    return await safeFetch('/api/v1/photos/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename, contentType }),
    });
  },

  async uploadPhoto(file) {
    if (!file) {
      throw new Error('No photo file provided for upload.');
    }

    // Validate type (jpeg/png/webp) in browser
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileType = file.type?.toLowerCase() || '';
    if (!allowedTypes.includes(fileType)) {
      throw new Error(`Unsupported image format "${file.type || 'unknown'}". Only JPEG, PNG, and WebP files are allowed.`);
    }

    // Validate size (max 10 MB) in browser
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(`Image size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`);
    }

    // 1. Give consent
    await this.giveConsent('photo_processing');

    // 2. Request signed upload URL
    const uploadMeta = await this.getPhotoUploadUrl({
      filename: file.name || 'user_photo.jpg',
      contentType: file.type || 'image/jpeg',
    });

    if (!uploadMeta || !uploadMeta.uploadUrl) {
      throw new Error('Failed to obtain photo upload URL from server');
    }

    // Attach authorization header if available
    const token = await getAuthToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    // 3. Upload file binary data using uploadUrl returned by upload-url endpoint
    const uploadRes = await fetch(uploadMeta.uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        ...authHeaders,
      },
      body: file,
    });

    if (!uploadRes.ok) {
      let serverErrorMsg = `Photo upload failed: HTTP ${uploadRes.status} ${uploadRes.statusText}`;
      try {
        const errJson = await uploadRes.json();
        serverErrorMsg = errJson.message || errJson.error || serverErrorMsg;
      } catch (_) {
        try {
          const errText = await uploadRes.text();
          if (errText) serverErrorMsg = errText;
        } catch (_) {}
      }
      throw new Error(serverErrorMsg);
    }

    // 4. Determine final accessible URL
    const photoUrl = `${API_BASE}/uploads/${uploadMeta.storageKey}`;
    return {
      photoId: uploadMeta.photoId,
      storageKey: uploadMeta.storageKey,
      photoUrl,
    };
  },

  async followUser(userId) {
    return await safeFetch(`/api/v1/users/${userId}/follow`, {
      method: 'POST',
    });
  },

  async unfollowUser(userId) {
    return await safeFetch(`/api/v1/users/${userId}/follow`, {
      method: 'DELETE',
    });
  },

  async searchUsers(query = '', limit = 20) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    const data = await safeFetch(`/api/v1/users/search?${params.toString()}`);
    if (data && data.users) return data;
    return { users: [] };
  },

  // 8. Saved Items & Wardrobe Collection (Phase C1)
  async getSavedItems({ page = 1, limit = 30 } = {}) {
    return await safeFetch(`/api/v1/saved?page=${page}&limit=${limit}`);
  },

  async saveItem(productId) {
    return await safeFetch(`/api/v1/saved/${productId}`, {
      method: 'POST',
    });
  },

  async removeSavedItem(productId) {
    return await safeFetch(`/api/v1/saved/${productId}`, {
      method: 'DELETE',
    });
  },

  // 9. Interaction Analytics (Phase C2)
  async logInteraction(eventData) {
    return await safeFetch('/api/v1/interactions', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },
};
