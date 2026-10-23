/**
 * Mock user data — realistic fashion creators and the current user.
 */

export const CURRENT_USER = {
  id: 'user-self',
  name: 'Maya Lin',
  handle: '@mayalin_style',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBo6NpMviUC1xxOfXLsehlL-JfBXdPW26nuUFlH5n0CibhfMujYS0XdLp0UAGLBvLqqRxrUYSSGNVYmAcRX005nZcSbidK9ac3-kslk-g6XPBMkuyC_Yz2iTU9ydveMzdyd5d4YQxctQbDixTUCTQlbSvMPtPO73NLqO5c4Fpn9p4Ic0eW-noKN2KaJsYp26uVqxi-Z4BqoMakgHXNXzizZVpEJpmIs9X9hp5QlFwJfuGxx1BpDEk_h',
  bio: 'Curating timeless silhouettes & modern chic. Paris & NYC ☕️ Virtual styling experimenter ✨',
  badge: 'Explorer',
  tier: 'Virtual Stylist Tier I',
  stats: { posts: 48, followers: '12.4k', following: 680, tryOns: 34 },
  verified: true,
};

export const MOCK_USERS = [
  {
    id: 'user-1',
    name: 'Camille Laurent',
    handle: '@camille_style',
    location: 'Le Marais, Paris',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-5azOThtktoHWnfBIW8xkzszBeuEk7_PyGpqwmRgJe8_wxsr7tUIzvaBea7m_ojHaTlXIEmRISYjGPPWs86LfNFYRteCg8JZWL6Zq0Kr2aP9kZ3LmPHhShb2fW9LS6cr8E9v-Rm1QPdvJWeKzyaxBdk0SEevhiaIH1tBywTN4tGXFw08OFTiMGSRTsvZpRgzw3CQ_FD7c02NwUCQgAfRYCaLTeLCsDcueyVmXuE9nACqzKasthJ83',
    verified: true,
    isFollowing: false,
    isRetailer: false,
  },
  {
    id: 'user-2',
    name: 'Marcus Vance',
    handle: '@marcus_fits',
    location: 'SoHo, New York',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzT8OMjQGRetrStn2vKe-aX_KmgF5V1UwBXLtOScZIJ7lBOr5qtTYJnBjHbD3hnvc24HJ7VKYenPgkmIIqbv13Lk_JJy_uzXazImiJLAPOVBfZtQ7K2-RHpfJSlhSEvRqv0d7YUGaw9cU8Sd7yRe63Ij5eJc57nrdNsaYLOMBmNv_qSOZ57FHPKgf2gN-y9uD9OZkXvBaXzED5WtzM6jJWs9A184wHRqW7wbNWbErEealIfgX0b-bo',
    verified: true,
    isFollowing: true,
    isRetailer: false,
  },
  {
    id: 'user-3',
    name: 'Sophia Nordic',
    handle: '@sophia_nordic',
    location: 'Stockholm, Sweden',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCsgS4wTFBNhsrdkk1NPd1SdVSgpQHo-tzVxGIPDmcrmxUp-iV9ds1V5KjL_DxPZwQ1yTJqB_iKS9_iWxH5fMi52-37VoBZXIDEObKy_VBIjI30_cOYlSKuGhzGr8H0moDFIzHFPHtzDxmL7c_vSra52TWDIGOvEXwgHUUOyk9s7JfE3m5_c_jg9_49PJH6QZdU8DSCagd_FqDcbla-XHK_KPrOIFg3PBkiuMFhsWG7cIchBW1XTKek',
    verified: true,
    isFollowing: true,
    isRetailer: false,
  },
  {
    id: 'user-4',
    name: 'Elena Atelier',
    handle: '@elena.atelier',
    location: 'Paris, France',
    badge: 'Pro Stylist',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBYw0Ry1F-O6MQ5smqMXh5LMlPIMehsc2e1Emv4CtTDiEtWNAPG7sboFVsl61bsYRwtQEo9Ow_BEd1IsXibAW8lTiL9dldo_8iqoyBrmiMZ0VPAJ540WUVuBebJA5zNY08mH6_xzYEMZOZrVRrB5BGCJWE3oaGe0wmFnCSxQUtA4GRTSi4QNDYgrQUTpxuE-33NmqhmMmZN27xcsap__xUdcUUJLmItlwTwOE7sVQktT9Pf4Kkos8iU',
    verified: true,
    isFollowing: false,
    isRetailer: false,
  },
];

export function getUserById(id) {
  if (id === CURRENT_USER.id) return CURRENT_USER;
  return MOCK_USERS.find((u) => u.id === id) || null;
}
