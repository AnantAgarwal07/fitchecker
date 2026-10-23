import { MOCK_OUTFITS } from './mockOutfits';

/**
 * Mock data for the For You personalized discovery page.
 * Contains:
 * 1. styleProfile algorithm insights
 * 2. curatedGarments (PRESERVED from original Stitch design with images, prices, ratings, sizes, links)
 * 3. forYouFeed: 35–45+ personalized outfit feed entries for continuous vertical scrolling.
 */

// Preserved curated garment cards from the original Stitch design
export const CURATED_GARMENTS = [
  {
    id: 'prod-5',
    name: 'Oversized Wool Blazer',
    brand: 'COS',
    price: 190,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBLkglbhii-aQbInMHcRcCzpvcKMNLoADMLIefWgZUUNvGrSFFAAGQKbotX0dJOGMicBw8Z9zvQdFjJIzeKU7cF3P_0zWuQf9KoGnmZMbSLSPcAY58l7EZFzQckr0eHCi6lFvqrs-pW-icjQZyb9V78CW5mA6s_Aojzas2t-0GBUJBMlqp9ulyf2xn9zNvUoyJGZmdne2daRicg8uoIkcrmik4edwNClUQt9b4EsbvCOvyLKwpjANl',
    rating: 4.8,
    reviewCount: 156,
    availableSizes: ['EU 34', 'EU 36', 'EU 38', 'EU 40'],
    shoppingUrl: 'https://www.cos.com',
    tryOnMatch: '96% Fit',
    category: 'Outerwear',
  },
  {
    id: 'prod-7',
    name: 'Numéro Neuf Bag',
    brand: 'Polène',
    price: 420,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTQLIjkwUidc3lDTT1TSdyF1X9gteDt2N4OPj_mrCLlQItb6jKnHcyuTgLzglVSq2wTQ2XHwYA1m1h7rcZ1d3281IKZ1grmX-SjbCHyvGa7WQaDSObutzQeRttxUhQ6FXHVYLBeR8Jh9rLDCfUxx5NZkp2gFlnNCDkqm8AgEI0mqFx-J4SMDSJqounVO6RBiOw9iU0t9WxPKJbz9RtQcZP9Am9mU7cYjaaCgWwEnxl57AWr0o8SO_h',
    rating: 4.9,
    reviewCount: 203,
    availableSizes: ['One Size'],
    shoppingUrl: 'https://www.polene-paris.com',
    tryOnMatch: '100% Fit',
    category: 'Bags',
  },
  {
    id: 'prod-6',
    name: 'Wide Pleat Slacks',
    brand: 'Arket',
    price: 120,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhVd4RPWiEXCU64zSM7aaf1cr_34z3ddb9fezbZxGrHwzOIOXjV-68Uyxq3YIjowK7CX_7p6o1mmm3Ls_bpS5GsFYTPOQiyf_IpbPKlR9Ap9y_Bo7LwSbB58qfNu_41Luz2HRq3r7huMWz3oMAgTesjYkfvpFbeykIpxLGABQvbJL94gf_FmtvJQftm0VsyGZyQz50RqVl72xlN9EE2VWg0zv3qDPF0YemEB6pZg7h04hAzdmr4PAG',
    rating: 4.5,
    reviewCount: 78,
    availableSizes: ['30/32', '32/32', '34/32'],
    shoppingUrl: 'https://www.arket.com',
    tryOnMatch: '94% Fit',
    category: 'Bottoms',
  },
  {
    id: 'prod-10',
    name: 'Silk Lapel Blazer',
    brand: 'Studio Nord',
    price: 240,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWkwi5O_LHTpe93UTOFm5hNuSiESd43CazJKw4F4anP2r9fpB_kC-EEgrLD0_TOamFFAlAyh55FhK0UTwVmLGWExR1buUK909EmaMZD4ipDLcmrWNfucETAc9QtgJIm4zpT1CiwaZahcJDe-lvqBp68vj4OHSanfSZfXMOPERhkUYgi4ozvl9Y2QtbbNEJPqnF7kinH7n48rAFYg84uAD82T8dPLiRWGYRKD3RhcVkRGucSBatAU7I',
    rating: 4.8,
    reviewCount: 87,
    availableSizes: ['XS', 'S', 'M', 'L'],
    shoppingUrl: 'https://www.studionord.com',
    tryOnMatch: '99% Fit',
    category: 'Outerwear',
  },
  {
    id: 'prod-ethnic-saree',
    name: 'Chanderi Draped Silk Saree',
    brand: 'Raw Mango',
    price: 280,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&auto=format&fit=crop&q=80',
    rating: 4.9,
    reviewCount: 285,
    availableSizes: ['Free Size'],
    shoppingUrl: 'https://www.rawmango.com',
    tryOnMatch: '97% Fit',
    category: 'Ethnic Wear',
  },
];

// Generate 35+ rich, unique For You feed outfits from MOCK_OUTFITS with personalized match scores
export const FOR_YOU_FEED = MOCK_OUTFITS.map((outfit, index) => {
  const matchPercent = Math.max(88, 99 - (index % 12));
  return {
    id: `fy-${outfit.id}`,
    originalId: outfit.id,
    name: outfit.name,
    category: outfit.category,
    price: outfit.price,
    rating: outfit.rating,
    reviewCount: outfit.reviewCount,
    matchScore: `${matchPercent}% Match`,
    availableSizes: outfit.availableSizes,
    shoppingUrl: outfit.shoppingUrl,
    creator: {
      id: outfit.source.id,
      name: outfit.source.name,
      handle: outfit.source.handle,
      location: outfit.source.location,
      avatar: outfit.source.avatar,
      verified: outfit.source.verified,
      isRetailer: outfit.source.isRetailer,
      isFollowing: false,
    },
    image: outfit.image,
    fallbackImage: outfit.fallbackImage,
    alt: `${outfit.name} curated look`,
    caption: outfit.caption,
    tags: outfit.tags,
    likes: outfit.likes,
    shares: outfit.shares,
    timeAgo: outfit.timeAgo,
    garments: outfit.garments,
    taggedCount: outfit.garments ? outfit.garments.length : 1,
  };
});

export const MOCK_FOR_YOU = {
  styleProfile: {
    matchScore: 98,
    traits: ['Neutral Tones', 'Clean Lines', 'Quiet Luxury', 'High-Street Fusion'],
  },
  curatedGarments: CURATED_GARMENTS,
  forYouFeed: FOR_YOU_FEED,
};
