import { MOCK_OUTFITS } from './mockOutfits';

/**
 * Mock posts for the Home Fashion Feed.
 * Derived from the comprehensive MOCK_OUTFITS collection, ensuring 15+ distinct, varied records
 * across casual, streetwear, ethnic wear, formal, party wear, dresses, and seasonal outfits.
 */
export const MOCK_POSTS = MOCK_OUTFITS.map((outfit, index) => ({
  id: outfit.id,
  user: {
    id: outfit.source.id,
    name: outfit.source.name,
    handle: outfit.source.handle,
    location: outfit.source.location,
    avatar: outfit.source.avatar,
    verified: outfit.source.verified,
    isRetailer: outfit.source.isRetailer,
  },
  image: outfit.image,
  fallbackImage: outfit.fallbackImage,
  alt: `${outfit.name} by ${outfit.source.name}`,
  caption: outfit.caption,
  tags: outfit.tags,
  likes: outfit.likes,
  shares: outfit.shares,
  timeAgo: outfit.timeAgo,
  category: outfit.category,
  price: outfit.price,
  rating: outfit.rating,
  availableSizes: outfit.availableSizes,
  shoppingUrl: outfit.shoppingUrl || 'https://www.myntra.com',
  shopUrl: outfit.shoppingUrl || 'https://www.myntra.com',
  garments: (outfit.garments || []).map((g) => ({
    ...g,
    shopUrl: g.shopUrl || g.shoppingUrl || outfit.shoppingUrl || 'https://www.myntra.com',
    shoppingUrl: g.shopUrl || g.shoppingUrl || outfit.shoppingUrl || 'https://www.myntra.com',
  })),
  taggedCount: outfit.garments ? outfit.garments.length : 1,
  products: outfit.garments
    ? outfit.garments.map((g) => ({
        id: g.id,
        name: g.name,
        brand: g.brand,
        price: g.price,
        image: g.image || outfit.image,
        shopUrl: g.shopUrl || g.shoppingUrl || outfit.shoppingUrl || 'https://www.myntra.com',
        shoppingUrl: g.shopUrl || g.shoppingUrl || outfit.shoppingUrl || 'https://www.myntra.com',
      }))
    : [
        {
          id: `prod-${outfit.id}`,
          name: outfit.name,
          brand: outfit.source.name,
          price: outfit.price,
          image: outfit.image,
          shopUrl: outfit.shoppingUrl || 'https://www.myntra.com',
          shoppingUrl: outfit.shoppingUrl || 'https://www.myntra.com',
        },
      ],
}));
