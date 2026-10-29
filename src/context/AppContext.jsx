import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { MOCK_POSTS } from '../data/mockPosts';
import { MOCK_USERS } from '../data/mockUsers';
import { MOCK_SAVED_TRYONS, DEFAULT_SOURCE_PERSONA } from '../data/mockTryOns';
import { api } from '../services/api';

const AppContext = createContext();

const STORAGE_KEY_LIKES = 'fitsyou_likes_v1';
const STORAGE_KEY_BOOKMARKS = 'fitsyou_bookmarks_v1';
const STORAGE_KEY_FOLLOWS = 'fitsyou_follows_v1';
const STORAGE_KEY_TRYONS = 'fitsyou_saved_tryons_v1';

export function AppProvider({ children }) {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();

  // Current real user from GET /api/v1/users/me
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Likes state initialized from mock data and localStorage
  const [likes, setLikes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LIKES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    const initial = {};
    MOCK_POSTS.forEach((p) => {
      initial[p.id] = { liked: false, count: p.likes };
    });
    initial['trend-1'] = { liked: false, count: 42800 };
    initial['trend-2'] = { liked: false, count: 38200 };
    initial['foryou-look-1'] = { liked: false, count: 8420 };
    return initial;
  });

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return { 'post-1': false, 'post-2': true };
  });

  // Follows state
  const [follows, setFollows] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FOLLOWS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    const initial = {};
    MOCK_USERS.forEach((u) => {
      initial[u.id] = !!u.isFollowing;
    });
    return initial;
  });

  // Saved try-on looks in profile
  const [savedTryOns, setSavedTryOns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRYONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return MOCK_SAVED_TRYONS;
  });

  // Current active try-on session
  const [activeTryOn, setActiveTryOn] = useState({
    id: null,
    garment: null,
    aiRenderedImage: null,
    originalPhoto: null,
    fitNote: null,
    matchScore: null,
    mode: null,
  });

  const [sourcePersona, setSourcePersona] = useState(DEFAULT_SOURCE_PERSONA);

  // Search overlay state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', icon: 'check_circle' });

  // Fetch real authenticated user from backend
  const refreshCurrentUser = useCallback(async () => {
    if (!isSignedIn) {
      setCurrentUser(null);
      setIsUserLoading(false);
      return;
    }

    try {
      setIsUserLoading(true);
      const data = await api.getCurrentUser();

      if (data && (data.user || data.id)) {
        const userObj = data.user || data;
        const bodyProfile = data.bodyProfile !== undefined ? data.bodyProfile : userObj.bodyProfile;
        const resolvedUser = {
          ...userObj,
          bodyProfile,
          avatar: userObj.avatarUrl || userObj.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        };
        setCurrentUser(resolvedUser);

        // Calibrate source persona with real user photo and height (Phase 2 & 3 fix)
        if (bodyProfile) {
          setSourcePersona((prev) => ({
            ...prev,
            photoUrl: bodyProfile.fullBodyPhotoUrl || resolvedUser.avatar,
            height: `${bodyProfile.heightCm || 168} cm`,
            heightCm: bodyProfile.heightCm || 168,
            name: resolvedUser.name || prev.name,
          }));
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn('[FitsYou Auth] Could not fetch /api/v1/users/me:', err);
      setCurrentUser(null);
    } finally {
      setIsUserLoading(false);
    }
  }, [isSignedIn]);

  // Sync with auth status
  useEffect(() => {
    if (isAuthLoaded) {
      if (isSignedIn) {
        refreshCurrentUser();
      } else {
        setCurrentUser(null);
        setIsUserLoading(false);
      }
    }
  }, [isAuthLoaded, isSignedIn, refreshCurrentUser]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(likes));
    } catch (e) {}
  }, [likes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {}
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FOLLOWS, JSON.stringify(follows));
    } catch (e) {}
  }, [follows]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRYONS, JSON.stringify(savedTryOns));
    } catch (e) {}
  }, [savedTryOns]);

  const showToast = (message, icon = 'check_circle') => {
    setToast({ visible: true, message, icon });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2400);
  };

  const toggleLike = (id, defaultCount = 100) => {
    setLikes((prev) => {
      const current = prev[id] || { liked: false, count: defaultCount };
      const isLiked = !current.liked;
      const count = isLiked ? current.count + 1 : Math.max(0, current.count - 1);
      return {
        ...prev,
        [id]: { liked: isLiked, count },
      };
    });
    // Optimistic background sync with live API
    api.toggleLike(id).catch(() => {});
  };

  const toggleBookmark = (id) => {
    setBookmarks((prev) => {
      const next = !prev[id];
      showToast(next ? 'Saved to bookmarks' : 'Removed from bookmarks', 'bookmark');
      return { ...prev, [id]: next };
    });
  };

  const toggleFollow = (userId, userName) => {
    setFollows((prev) => {
      const next = !prev[userId];
      showToast(
        next ? `Following ${userName || 'creator'}` : `Unfollowed ${userName || 'creator'}`,
        next ? 'person_add' : 'person_remove'
      );
      return { ...prev, [userId]: next };
    });
  };

  const toggleTryOnPrivacy = (tryOnId) => {
    setSavedTryOns((prev) =>
      prev.map((item) => {
        if (item.id === tryOnId) {
          const nextPrivacy = !item.isPrivate;
          showToast(nextPrivacy ? 'Look set to Private' : 'Look is now Public', nextPrivacy ? 'lock' : 'public');
          return { ...item, isPrivate: nextPrivacy };
        }
        return item;
      })
    );
  };

  const deleteTryOn = (tryOnId) => {
    setSavedTryOns((prev) => prev.filter((item) => item.id !== tryOnId));
    showToast('Look removed from saved collection', 'delete');
  };

  const saveTryOnToCollection = (tryOnData) => {
    const newItem = {
      id: 'tryon-' + Date.now(),
      title: `${tryOnData.garment.brand} ${tryOnData.garment.name}`,
      brand: tryOnData.garment.brand,
      price: tryOnData.garment.price,
      isPrivate: true,
      date: 'Just now',
      image: tryOnData.aiRenderedImage,
      originalPhoto: tryOnData.originalPhoto,
      garmentId: tryOnData.garment.id,
      fitScore: tryOnData.matchScore || '99%',
    };
    setSavedTryOns((prev) => [newItem, ...prev]);
    showToast('Look saved to your Virtual Wardrobe', 'checkroom');
  };

  const setGarmentForTryOn = (garment) => {
    setActiveTryOn({
      id: null,
      garment,
      aiRenderedImage: null,
      originalPhoto: null,
      fitNote: null,
      matchScore: null,
      mode: null,
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isUserLoading,
        refreshCurrentUser,
        likes,
        bookmarks,
        follows,
        savedTryOns,
        activeTryOn,
        sourcePersona,
        setSourcePersona,
        setActiveTryOn,
        isSearchOpen,
        setIsSearchOpen,
        searchQuery,
        setSearchQuery,
        toast,
        showToast,
        toggleLike,
        toggleBookmark,
        toggleFollow,
        toggleTryOnPrivacy,
        deleteTryOn,
        saveTryOnToCollection,
        setGarmentForTryOn,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
