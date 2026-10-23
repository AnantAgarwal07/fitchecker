/**
 * Mock data for the Virtual Fitting Room and Profile Saved Try-Ons.
 */
export const DEFAULT_SOURCE_PERSONA = {
  id: 'persona-maya',
  name: 'Maya Lin',
  role: 'Default Model',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2NzoqLirHnxaK1Cr_eXHTqZeJiNlsEMZW3IOR_eV7ce4xvaZaeikKAx8LvF46dk6oRur6hqQj9QafN0ASHtEzQV35cMIamKnYVK8USBdPygQyvGaxGP_XjFDKWwcemsvAhEOviO8BmxAEBn61YXrO2xgwQ92iRdFJHc5rzMoitLtATuWgr3ppYxPR7ev8uDTpb9YoXrXVVs7O9m-5XGD7K5uCq8SvrJKBk8aEKo03DYamH9KaeTlv',
  originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
};

export const INITIAL_TRYON_RESULT = {
  id: 'tryon-active-1',
  garment: {
    id: 'prod-10',
    name: 'Silk Lapel Blazer',
    brand: 'Studio Nord',
    collection: 'FW24 Runway Collection',
    price: 240,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCWkwi5O_LHTpe93UTOFm5hNuSiESd43CazJKw4F4anP2r9fpB_kC-EEgrLD0_TOamFFAlAyh55FhK0UTwVmLGWExR1buUK909EmaMZD4ipDLcmrWNfucETAc9QtgJIm4zpT1CiwaZahcJDe-lvqBp68vj4OHSanfSZfXMOPERhkUYgi4ozvl9Y2QtbbNEJPqnF7kinH7n48rAFYg84uAD82T8dPLiRWGYRKD3RhcVkRGucSBatAU7I',
  },
  aiRenderedImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQdMFR16QktoN4cvDAU2cTmJP_GfkrKUwpbnhzr5hr2HWhjmOA534zJ-ZHCKnCwTXFtThM2LXjzbnNLThh59zEIPscwUqlkgTNlcVQ6X0PxFQFYMo6ArvBLbDZzby4R_I5zZkdvAgfEdbuaup4c0--ajo-5LEI0BsahlWZbiWH72UbAkTQTIQw4cYUweMhjFObcK5wgZC_bvePjlcsJ59O4h-FboN-8ED2lW7NZWM55OEsu3HqJ6kJ',
  originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
  fitNote: 'Structured Silk Fit',
  matchScore: '99% Fit',
};

export const MOCK_SAVED_TRYONS = [
  {
    id: 'tryon-1',
    title: 'Studio Nord Silk Lapel Blazer',
    brand: 'Studio Nord',
    price: 240,
    isPrivate: true,
    date: 'Oct 22',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBQdMFR16QktoN4cvDAU2cTmJP_GfkrKUwpbnhzr5hr2HWhjmOA534zJ-ZHCKnCwTXFtThM2LXjzbnNLThh59zEIPscwUqlkgTNlcVQ6X0PxFQFYMo6ArvBLbDZzby4R_I5zZkdvAgfEdbuaup4c0--ajo-5LEI0BsahlWZbiWH72UbAkTQTIQw4cYUweMhjFObcK5wgZC_bvePjlcsJ59O4h-FboN-8ED2lW7NZWM55OEsu3HqJ6kJ',
    originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
    garmentId: 'prod-10',
    fitScore: '99%',
  },
  {
    id: 'tryon-2',
    title: 'Acne Studios Camel Trench Coat',
    brand: 'Acne Studios',
    price: 450,
    isPrivate: false,
    date: 'Oct 19',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDK81w8EY9J65YELLe-9RaYvGDB-eAJLQB9TgENFWaERSa5kIBgypxViggHkTA81m1DvR1dOA-VueW_lxoZtrL_No5NOs5V18rBE5kv_t6kISxen1ywyDmUjpj_mGFg4k3FEMYRg9ovCWuRZNgP_4GRiypMqOs_-nhb-OcYlZqdUwNDBMa-Fad3TGf9_-T8BIoqs-yQshah_NwC2vPhLt1C0W3vAVeL6ehuJyyHYGO8tDTHiJCh35MX',
    originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
    garmentId: 'prod-1',
    fitScore: '97%',
  },
  {
    id: 'tryon-3',
    title: 'COS Oversized Wool Blazer',
    brand: 'COS',
    price: 190,
    isPrivate: true,
    date: 'Oct 15',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7vFJyrkfyW9_PwmhaSWEpvX_cC3wn8dR7fyWJCcPICqvB_Y3o8iFVf_2X2R-bbvumwXDdI7m1J4qx3QhAbWXEBjleBQnVQaPviy8-egICP8uGtUIoL7pJFEbeubkJFpvXSbplpxUERmI0cTbyO-yt955Di8I4WCwzrbWEpPrNWjpq3MAjl7sWsVhK_QL8SCVA7pcxXpgWP3i_FqHmwhYWjrTAV6jVwhh8-vL5DOc58XxTnF2goyz5',
    originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
    garmentId: 'prod-5',
    fitScore: '95%',
  },
  {
    id: 'tryon-4',
    title: 'Monochrome Wool Coat Ensemble',
    brand: 'Toteme',
    price: 420,
    isPrivate: false,
    date: 'Oct 12',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDwizhcuBSJZqFUCTHsgT_cS9R5fL_AgPuuPZ1G0CSmM1QF5QiOannLSFCVNOFAoKwrI3J4jN01qd6jxSYJhXnQ13TjuuiBRGhkypjJE1jIMBRMnuhYZ3CHaT7OO7v3EE82Fw29zSP9hisxBOtqzefPsGT2PYRw0_BhyWOpZvS_YP5YttI5MlOBxSFea43z3uCtTZoEeDKaqCorbfY4Z9EOUr00d63h6gkwB7-VHvHbw2jriXdI05KV',
    originalPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwj0o91JCAVz-jgmtFC9nhZd31_ONaHV1uJHM7XAUfVUSRupbtwoNYcwmbHYH1IX7XRpyyB-kLY72ty7qX24ZUsx7D2Srp0W6a1-QvjJFtHe4uY2RrL8z4E-E3U2xnJxl_YSlPc5TCiUtmqvF7aM6fHdToUAf7ooKRVEE4llZCb99-zQkVmRjJxxVsnn5fo4AFDOJt1VhWj9MVRLJzcfCDyouw788EzyWKn_cabeRnVzYK70nK1aHf',
    garmentId: 'prod-8',
    fitScore: '98%',
  },
];
