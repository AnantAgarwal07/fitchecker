import { MOCK_POSTS } from '../data/mockPosts';
import { MOCK_TRENDING_LOOKS } from '../data/mockTrending';
import { MOCK_FOR_YOU } from '../data/mockForYou';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import { MOCK_SAVED_TRYONS } from '../data/mockTryOns';
import { CURRENT_USER } from '../data/mockUsers';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
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
  async getPosts({ tab = 'all', category = '', page = 1, limit = 20, userId = '' } = {}) {
    const params = new URLSearchParams();
    if (tab && tab !== 'all') params.set('tab', tab);
    if (category) params.set('category', category);
    if (userId) params.set('userId', userId);
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

  async toggleLike(postId, userId = 'u-ananya-sharma-001') {
    const data = await safeFetch(`/api/v1/posts/${postId}/like`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    return data;
  },

  // 2. Trending Outfits & Ranking
  async getTrending({ category = 'all', limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/trending?${params.toString()}`);
    if (data && data.trendingLooks) {
      return data.trendingLooks;
    }
    if (USE_MOCKS) return MOCK_TRENDING_LOOKS;
    return [];
  },

  // 3. For-You AI Recommendations
  async getForYou({ userId = 'u-ananya-sharma-001', category = 'all', limit = 20, forceRefresh = false } = {}) {
    const params = new URLSearchParams();
    if (userId) params.set('userId', userId);
    if (category && category !== 'all') params.set('category', category);
    if (forceRefresh) params.set('forceRefresh', 'true');
    params.set('limit', String(limit));

    const data = await safeFetch(`/api/v1/for-you?${params.toString()}`);
    if (data && data.outfits) {
      return {
        forYouFeed: data.outfits,
        styleProfile: data.userProfile || MOCK_FOR_YOU.styleProfile,
        curatedGarments: data.outfits.slice(0, 4).map((o) => o.defaultGarment || o.garments?.[0]),
      };
    }
    if (USE_MOCKS) return MOCK_FOR_YOU;
    return { forYouFeed: [], styleProfile: null, curatedGarments: [] };
  },

  // 4. Products & Catalog
  async getProducts({ q = '', category = '', audience = '', minPrice, maxPrice, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (audience) params.set('audience', audience);
    if (minPrice !== undefined) params.set('minPrice', String(minPrice));
    if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
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
  async submitTryOn({ userId = 'u-ananya-sharma-001', productId, userPhotoUrl, userHeightCm = 165, sizeSelected = 'M' }) {
    const numProductId = typeof productId === 'string' ? parseInt(productId.replace(/\D/g, ''), 10) || 392 : productId;
    return await safeFetch('/api/v1/try-on', {
      method: 'POST',
      body: JSON.stringify({
        userId,
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

  async getTryOnSessions({ userId = 'user-self', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    params.set('userId', userId);
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

  // 6. User Profile, Social Graph & Body Profile
  async getUserProfile(id = 'user-self') {
    const data = await safeFetch(`/api/v1/users/${id}`);
    if (data) return data;
    if (USE_MOCKS) return CURRENT_USER;
    return null;
  },

  async updateBodyProfile(userId = 'user-self', profileData) {
    return await safeFetch(`/api/v1/users/${userId}/body-profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
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

  async searchUsers(query) {
    return await safeFetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
  },

  // 7. Saved Items & Wardrobe Collection (Phase C1)
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

  // 8. Interaction Analytics (Phase C2)
  async logInteraction(eventData) {
    return await safeFetch('/api/v1/interactions', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },
};
