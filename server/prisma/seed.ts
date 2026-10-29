import { prisma } from "../src/db.js";
import { computeAndStoreFeed } from "../src/recommender/index.js";

async function main() {
  console.log("🌱 Starting FitsYou database seed...");

  // Verify Product and ProductImage exist
  const productCount = await prisma.product.count();
  const imageCount = await prisma.productImage.count();
  console.log(`📦 Verified existing catalog: ${productCount} products, ${imageCount} images.`);

  if (productCount === 0) {
    throw new Error("No products found in database! Aborting seed.");
  }

  // 1. Create/Upsert 10 Creators with Body Profiles (keeping existing 3 demo users and IDs)
  console.log("👤 Creating 10 creators and body profiles...");

  const creatorsData = [
    {
      id: "u-ananya-sharma-001",
      email: "ananya@example.com",
      handle: "ananyastyle",
      name: "Ananya Sharma",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
      bio: "Fashion enthusiast | Streetwear & Indie fusion | Mumbai",
      location: "Mumbai, India",
      isRetailer: false,
      verified: true,
      bodyProfile: {
        heightCm: 165,
        gender: "women",
        bodyType: "hourglass",
        bustChestCm: 86,
        chestCm: 86,
        waistCm: 68,
        hipsCm: 94,
        inseamCm: 76,
        shoulderCm: 38,
        fitPreference: "fitted",
        styleVibe: "streetwear",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-rohan-mehta-002",
      email: "rohan@example.com",
      handle: "rohanfits",
      name: "Rohan Mehta",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
      bio: "Minimalist menswear | Smart casuals & classic layers | Bengaluru",
      location: "Bengaluru, India",
      isRetailer: false,
      verified: true,
      bodyProfile: {
        heightCm: 180,
        gender: "men",
        bodyType: "athletic",
        bustChestCm: 102,
        chestCm: 102,
        waistCm: 81,
        hipsCm: 98,
        inseamCm: 82,
        shoulderCm: 45,
        fitPreference: "regular",
        styleVibe: "classic",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-tara-kapoor-003",
      email: "tara@example.com",
      handle: "tarafashion",
      name: "Tara Kapoor",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
      bio: "Ethnic glam & contemporary draping ✨ | Delhi",
      location: "Delhi, India",
      isRetailer: false,
      verified: false,
      bodyProfile: {
        heightCm: 170,
        gender: "women",
        bodyType: "rectangle",
        bustChestCm: 88,
        chestCm: 88,
        waistCm: 72,
        hipsCm: 96,
        inseamCm: 79,
        shoulderCm: 40,
        fitPreference: "relaxed",
        styleVibe: "ethnic",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-kabir-sen-004",
      email: "kabir@example.com",
      handle: "kabirstreet",
      name: "Kabir Sen",
      avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80",
      bio: "Urban oversized fits & streetwear culture | Bandra",
      location: "Mumbai, India",
      isRetailer: false,
      verified: true,
      bodyProfile: {
        heightCm: 178,
        gender: "men",
        bodyType: "athletic",
        bustChestCm: 98,
        chestCm: 98,
        waistCm: 78,
        hipsCm: 95,
        inseamCm: 81,
        shoulderCm: 44,
        fitPreference: "oversized",
        styleVibe: "streetwear",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-priya-patel-005",
      email: "priya@example.com",
      handle: "priyastyle",
      name: "Priya Patel",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
      bio: "Handloom revival & festive silhouettes 🪷 | Ahmedabad",
      location: "Ahmedabad, India",
      isRetailer: false,
      verified: true,
      bodyProfile: {
        heightCm: 162,
        gender: "women",
        bodyType: "pear",
        bustChestCm: 84,
        chestCm: 84,
        waistCm: 66,
        hipsCm: 92,
        inseamCm: 74,
        shoulderCm: 37,
        fitPreference: "regular",
        styleVibe: "ethnic",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-arjun-nair-006",
      email: "arjun@example.com",
      handle: "arjuntailored",
      name: "Arjun Nair",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
      bio: "Bespoke tailoring, crisp lines & sartorial elegance 👔",
      location: "Bengaluru, India",
      isRetailer: false,
      verified: false,
      bodyProfile: {
        heightCm: 182,
        gender: "men",
        bodyType: "athletic",
        bustChestCm: 104,
        chestCm: 104,
        waistCm: 84,
        hipsCm: 100,
        inseamCm: 83,
        shoulderCm: 46,
        fitPreference: "fitted",
        styleVibe: "formal",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-zoya-khan-007",
      email: "zoya@example.com",
      handle: "zoyaglam",
      name: "Zoya Khan",
      avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80",
      bio: "Cocktail nights, satin wraps & high glam 🪩 | South Delhi",
      location: "Delhi, India",
      isRetailer: false,
      verified: true,
      bodyProfile: {
        heightCm: 168,
        gender: "women",
        bodyType: "hourglass",
        bustChestCm: 90,
        chestCm: 90,
        waistCm: 70,
        hipsCm: 97,
        inseamCm: 78,
        shoulderCm: 39,
        fitPreference: "fitted",
        styleVibe: "party wear",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-neha-verma-008",
      email: "neha@example.com",
      handle: "nehacampus",
      name: "Neha Verma",
      avatarUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=300&q=80",
      bio: "Campus daily fits, comfy denims & coffee aesthetics ☕",
      location: "Pune, India",
      isRetailer: false,
      verified: false,
      bodyProfile: {
        heightCm: 164,
        gender: "women",
        bodyType: "rectangle",
        bustChestCm: 82,
        chestCm: 82,
        waistCm: 65,
        hipsCm: 90,
        inseamCm: 75,
        shoulderCm: 36,
        fitPreference: "relaxed",
        styleVibe: "college outfits",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-aditya-rao-009",
      email: "aditya@example.com",
      handle: "adityacasual",
      name: "Aditya Rao",
      avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80",
      bio: "Smart casuals, loafers & weekend getaways 🌿",
      location: "Hyderabad, India",
      isRetailer: false,
      verified: false,
      bodyProfile: {
        heightCm: 176,
        gender: "men",
        bodyType: "athletic",
        bustChestCm: 96,
        chestCm: 96,
        waistCm: 80,
        hipsCm: 94,
        inseamCm: 80,
        shoulderCm: 43,
        fitPreference: "regular",
        styleVibe: "casual",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=600&q=80",
      },
    },
    {
      id: "u-meera-reddy-010",
      email: "meera@example.com",
      handle: "meeradesign",
      name: "Meera Reddy",
      avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80",
      bio: "Editorial fashion designer & sustainable draping 🌿 | Chennai",
      location: "Chennai, India",
      isRetailer: true,
      verified: true,
      bodyProfile: {
        heightCm: 167,
        gender: "women",
        bodyType: "hourglass",
        bustChestCm: 89,
        chestCm: 89,
        waistCm: 71,
        hipsCm: 95,
        inseamCm: 77,
        shoulderCm: 38,
        fitPreference: "regular",
        styleVibe: "dresses",
        fullBodyPhotoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
      },
    },
  ];

  for (const c of creatorsData) {
    const { bodyProfile, ...userData } = c;
    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        name: userData.name,
        handle: userData.handle,
        avatarUrl: userData.avatarUrl,
        bio: userData.bio,
        location: userData.location,
        isRetailer: userData.isRetailer,
        verified: userData.verified,
      },
      create: userData,
    });

    if (bodyProfile) {
      await prisma.bodyProfile.upsert({
        where: { userId: user.id },
        update: bodyProfile,
        create: {
          userId: user.id,
          ...bodyProfile,
        },
      });
    }
  }

  // 2. Setup Follow connections so the "Following" tab has rich content
  console.log("🤝 Creating creator follows...");
  const followPairs = [
    // Ananya follows multiple creators
    ["u-ananya-sharma-001", "u-rohan-mehta-002"],
    ["u-ananya-sharma-001", "u-tara-kapoor-003"],
    ["u-ananya-sharma-001", "u-kabir-sen-004"],
    ["u-ananya-sharma-001", "u-priya-patel-005"],
    ["u-ananya-sharma-001", "u-zoya-khan-007"],
    ["u-ananya-sharma-001", "u-neha-verma-008"],
    ["u-ananya-sharma-001", "u-meera-reddy-010"],
    // Other cross-follows
    ["u-rohan-mehta-002", "u-ananya-sharma-001"],
    ["u-rohan-mehta-002", "u-arjun-nair-006"],
    ["u-rohan-mehta-002", "u-aditya-rao-009"],
    ["u-tara-kapoor-003", "u-priya-patel-005"],
    ["u-tara-kapoor-003", "u-meera-reddy-010"],
    ["u-kabir-sen-004", "u-ananya-sharma-001"],
    ["u-kabir-sen-004", "u-neha-verma-008"],
    ["u-priya-patel-005", "u-tara-kapoor-003"],
    ["u-arjun-nair-006", "u-rohan-mehta-002"],
    ["u-zoya-khan-007", "u-ananya-sharma-001"],
    ["u-zoya-khan-007", "u-meera-reddy-010"],
  ];

  for (const [followerId, followingId] of followPairs) {
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });
  }

  // 3. Fetch real products from DB catalog for each category & audience
  console.log("📦 Fetching real catalog products for post tagging...");
  const menTops = await prisma.product.findMany({
    where: { audience: "men", category: { in: ["topwear", "shirts", "tshirts", "Shirts", "Tops", "clothing"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  const menBottoms = await prisma.product.findMany({
    where: { audience: "men", category: { in: ["bottomwear", "jeans", "trousers", "track pants", "Track Pants", "clothing"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  const womenTops = await prisma.product.findMany({
    where: { audience: "women", category: { in: ["tops", "topwear", "tshirts", "Tops", "clothing"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  const womenBottoms = await prisma.product.findMany({
    where: { audience: "women", category: { in: ["bottomwear", "jeans", "palazzos", "skirts", "clothing"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  const womenEthnic = await prisma.product.findMany({
    where: { audience: "women", category: { in: ["sarees", "Sarees", "ethnic wear", "kurtas", "kurtis", "kurta sets", "Kurta Sets"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  const menEthnic = await prisma.product.findMany({
    where: { audience: "men", category: { in: ["ethnic wear", "kurtas", "sherwani", "sherwani set", "sherwani sets"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 10,
  });

  const womenDresses = await prisma.product.findMany({
    where: { audience: "women", category: { in: ["dresses", "jumpsuits", "rompers", "clothing"] } },
    select: { id: true, name: true, brand: true, category: true, currentPrice: true, ProductImage: { take: 2, orderBy: { position: "asc" } } },
    take: 20,
  });

  // 4. Generate at least 42 Posts across 7 categories (6 posts per category)
  // Categories: casual, streetwear, ethnic wear, formal, party wear, dresses, college outfits
  console.log("👗 Generating 42 idempotent curated looks across 7 categories...");

  interface PostBlueprint {
    category: string;
    userId: string;
    caption: string;
    tags: string[];
    primaryProduct: any;
    secondaryProduct?: any;
    editorialImage?: string;
  }

  const blueprints: PostBlueprint[] = [
    // 1. CASUAL (6 posts)
    {
      category: "casual",
      userId: "u-ananya-sharma-001",
      caption: "Graphic crop top paired with airy palazzos for an effortless sunny day vibe ✨",
      tags: ["casual", "summer fit", "palazzos", "crop top"],
      primaryProduct: womenTops[0],
      secondaryProduct: womenBottoms[0],
    },
    {
      category: "casual",
      userId: "u-rohan-mehta-002",
      caption: "Crisp white linen feel shirt and relaxed chinos. Breathable, sharp, weekend ready 🤍",
      tags: ["casual", "white shirt", "chinos", "minimalist"],
      primaryProduct: menTops[0],
      secondaryProduct: menBottoms[0],
    },
    {
      category: "casual",
      userId: "u-aditya-rao-009",
      caption: "Olive polo tee and relaxed denim trousers for afternoon cafe work ☕",
      tags: ["casual", "polo", "denim", "everyday"],
      primaryProduct: menTops[1],
      secondaryProduct: menBottoms[1],
    },
    {
      category: "casual",
      userId: "u-neha-verma-008",
      caption: "Pastel boxy knit top with relaxed fit straight jeans. Easy Sunday walk fit 🌸",
      tags: ["casual", "pastel", "denim", "weekend"],
      primaryProduct: womenTops[1],
      secondaryProduct: womenBottoms[1],
    },
    {
      category: "casual",
      userId: "u-kabir-sen-004",
      caption: "Lightweight summer knit and breezy tapered track trousers 🍃",
      tags: ["casual", "knitwear", "tapered", "easy"],
      primaryProduct: menTops[2],
      secondaryProduct: menBottoms[2],
    },
    {
      category: "casual",
      userId: "u-priya-patel-005",
      caption: "Embroidered cotton short kurti styled with flared denim trousers 🌼",
      tags: ["casual", "kurti", "fusion", "cotton"],
      primaryProduct: womenTops[2],
      secondaryProduct: womenBottoms[2],
    },

    // 2. STREETWEAR (6 posts)
    {
      category: "streetwear",
      userId: "u-kabir-sen-004",
      caption: "Oversized graphic tee with baggy cargo trousers and chunky retro kicks ⚡",
      tags: ["streetwear", "oversized", "graphic tee", "cargos"],
      primaryProduct: menTops[3] || menTops[0],
      secondaryProduct: menBottoms[3] || menBottoms[0],
    },
    {
      category: "streetwear",
      userId: "u-ananya-sharma-001",
      caption: "Drop-shoulder printed tee tucked into high-waist utility track pants 🔥",
      tags: ["streetwear", "utility", "grunge", "indie"],
      primaryProduct: womenTops[3] || womenTops[0],
      secondaryProduct: womenBottoms[3] || womenBottoms[0],
    },
    {
      category: "streetwear",
      userId: "u-rohan-mehta-002",
      caption: "Monochrome layering: structured boxy tee over washed black denim 🖤",
      tags: ["streetwear", "monochrome", "minimalist", "allblack"],
      primaryProduct: menTops[4] || menTops[1],
      secondaryProduct: menBottoms[4] || menBottoms[1],
    },
    {
      category: "streetwear",
      userId: "u-neha-verma-008",
      caption: "Cropped skate sweatshirt with wide-leg relaxed denim. Skater aesthetic 🛹",
      tags: ["streetwear", "skate", "wide leg", "cropped"],
      primaryProduct: womenTops[4] || womenTops[1],
      secondaryProduct: womenBottoms[4] || womenBottoms[1],
    },
    {
      category: "streetwear",
      userId: "u-aditya-rao-009",
      caption: "Street culture: vintage wash graphic crewneck with utility jogger pants 👟",
      tags: ["streetwear", "vintage", "crewneck", "joggers"],
      primaryProduct: menTops[5] || menTops[2],
      secondaryProduct: menBottoms[5] || menBottoms[2],
    },
    {
      category: "streetwear",
      userId: "u-zoya-khan-007",
      caption: "High-contrast cropped racerback top with technical cargo bottoms 🏎️",
      tags: ["streetwear", "racerback", "technical", "edgy"],
      primaryProduct: womenTops[5] || womenTops[2],
      secondaryProduct: womenBottoms[5] || womenBottoms[2],
    },

    // 3. ETHNIC WEAR (6 posts)
    {
      category: "ethnic wear",
      userId: "u-tara-kapoor-003",
      caption: "Bandhani gotta patti saree in radiant scarlet. Festive evenings and golden hour glow 🪔",
      tags: ["ethnic wear", "saree", "bandhani", "festive"],
      primaryProduct: womenEthnic[0],
    },
    {
      category: "ethnic wear",
      userId: "u-priya-patel-005",
      caption: "Chanderi silk handloom saree with antique gold zari border. Pure timeless craft ✨",
      tags: ["ethnic wear", "chanderi", "handloom", "heritage"],
      primaryProduct: womenEthnic[1] || womenEthnic[0],
    },
    {
      category: "ethnic wear",
      userId: "u-meera-reddy-010",
      caption: "Block printed Mulmul Anarkali suit with tiered palazzo pants 🌸",
      tags: ["ethnic wear", "anarkali", "mulmul", "artisanal"],
      primaryProduct: womenEthnic[2] || womenEthnic[0],
      secondaryProduct: womenBottoms[6] || womenBottoms[0],
    },
    {
      category: "ethnic wear",
      userId: "u-rohan-mehta-002",
      caption: "Rust embroidered pathani kurta in pure slub cotton. Clean festive tailoring 🪔",
      tags: ["ethnic wear", "pathani", "kurta", "mens ethnic"],
      primaryProduct: menEthnic[0] || menTops[6] || menTops[0],
    },
    {
      category: "ethnic wear",
      userId: "u-arjun-nair-006",
      caption: "Raw silk bundi jacket layered over ivory long kurta. Royal wedding guest elegance 👑",
      tags: ["ethnic wear", "sherwani", "kurta", "wedding"],
      primaryProduct: menEthnic[1] || menEthnic[0] || menTops[7] || menTops[1],
    },
    {
      category: "ethnic wear",
      userId: "u-tara-kapoor-003",
      caption: "Pastel organza saree with delicate floral sequin borders. Sangeet ready 💫",
      tags: ["ethnic wear", "organza", "saree", "sequins"],
      primaryProduct: womenEthnic[3] || womenEthnic[0],
    },

    // 4. FORMAL (6 posts)
    {
      category: "formal",
      userId: "u-arjun-nair-006",
      caption: "Tailored micro-check navy dress shirt on crisp charcoal wool trousers 💼",
      tags: ["formal", "menswear", "navy", "tailored"],
      primaryProduct: menTops[6] || menTops[0],
      secondaryProduct: menBottoms[6] || menBottoms[0],
    },
    {
      category: "formal",
      userId: "u-rohan-mehta-002",
      caption: "French cuff spread-collar white dress shirt with tailored pleated trousers 🏢",
      tags: ["formal", "white shirt", "pleated", "corporate"],
      primaryProduct: menTops[7] || menTops[1],
      secondaryProduct: menBottoms[7] || menBottoms[1],
    },
    {
      category: "formal",
      userId: "u-meera-reddy-010",
      caption: "Silk formal shirt tucked into high-rise tapered formal trousers. Power dressing 👠",
      tags: ["formal", "power dressing", "silk shirt", "trousers"],
      primaryProduct: womenTops[6] || womenTops[0],
      secondaryProduct: womenBottoms[7] || womenBottoms[1],
    },
    {
      category: "formal",
      userId: "u-ananya-sharma-001",
      caption: "Tailored linen blazer blouse with cigarette cut formal pants 📋",
      tags: ["formal", "linen", "blazer", "workwear"],
      primaryProduct: womenTops[7] || womenTops[1],
      secondaryProduct: womenBottoms[8] || womenBottoms[2],
    },
    {
      category: "formal",
      userId: "u-aditya-rao-009",
      caption: "Sky blue oxford dress shirt paired with dark navy tailored chinos 👔",
      tags: ["formal", "oxford", "smart formal", "boardroom"],
      primaryProduct: menTops[8] || menTops[2],
      secondaryProduct: menBottoms[8] || menBottoms[2],
    },
    {
      category: "formal",
      userId: "u-arjun-nair-006",
      caption: "Monochrome formal ensemble: black structured dress shirt and slate slim trousers 🖋️",
      tags: ["formal", "monochrome", "slim fit", "executive"],
      primaryProduct: menTops[9] || menTops[3],
      secondaryProduct: menBottoms[9] || menBottoms[3],
    },

    // 5. PARTY WEAR (6 posts)
    {
      category: "party wear",
      userId: "u-zoya-khan-007",
      caption: "Metallic emerald wrap top with draped neckline. Saturday night disco glam 🪩",
      tags: ["party wear", "wrap top", "glam", "night out"],
      primaryProduct: womenTops[8] || womenTops[0],
      secondaryProduct: womenBottoms[9] || womenBottoms[0],
    },
    {
      category: "party wear",
      userId: "u-ananya-sharma-001",
      caption: "Satin keyhole crop top with high-shine wide palazzos. Cocktails & city lights 🍸",
      tags: ["party wear", "satin", "cocktail", "shimmer"],
      primaryProduct: womenTops[9] || womenTops[1],
      secondaryProduct: womenBottoms[10] || womenBottoms[1],
    },
    {
      category: "party wear",
      userId: "u-zoya-khan-007",
      caption: "Velvet bodycon dress with subtle sequin piping. Unapologetic party glamour ✨",
      tags: ["party wear", "velvet", "bodycon", "glamour"],
      primaryProduct: womenDresses[0],
    },
    {
      category: "party wear",
      userId: "u-kabir-sen-004",
      caption: "Silk-blend camp collar shirt in abstract midnight gold print. Rooftop lounge energy 🥂",
      tags: ["party wear", "camp collar", "night out", "statement"],
      primaryProduct: menTops[10] || menTops[0],
      secondaryProduct: menBottoms[10] || menBottoms[0],
    },
    {
      category: "party wear",
      userId: "u-tara-kapoor-003",
      caption: "Dramatic flared cocktail dress with sweetheart neckline and sheer overlay 💃",
      tags: ["party wear", "cocktail", "sheer", "evening wear"],
      primaryProduct: womenDresses[1] || womenDresses[0],
    },
    {
      category: "party wear",
      userId: "u-aditya-rao-009",
      caption: "Black textured satin shirt on tailored charcoal trousers. Clean party elegance 🌙",
      tags: ["party wear", "satin shirt", "evening", "sleek"],
      primaryProduct: menTops[11] || menTops[1],
      secondaryProduct: menBottoms[11] || menBottoms[1],
    },

    // 6. DRESSES (6 posts)
    {
      category: "dresses",
      userId: "u-tara-kapoor-003",
      caption: "Navy blue fit-and-flare midi dress. The most effortless Sunday brunch silhouette 🥐",
      tags: ["dresses", "fit and flare", "brunch", "midi dress"],
      primaryProduct: womenDresses[2] || womenDresses[0],
    },
    {
      category: "dresses",
      userId: "u-meera-reddy-010",
      caption: "Tiered bohemian maxi dress with puff sleeves and tie waist 🌻",
      tags: ["dresses", "maxi dress", "boho", "tiered"],
      primaryProduct: womenDresses[3] || womenDresses[1],
    },
    {
      category: "dresses",
      userId: "u-zoya-khan-007",
      caption: "Ruched sweetheart bodycon dress in crimson red. Statement silhouette ❤️",
      tags: ["dresses", "bodycon", "ruched", "crimson"],
      primaryProduct: womenDresses[4] || womenDresses[0],
    },
    {
      category: "dresses",
      userId: "u-ananya-sharma-001",
      caption: "Floral print skater dress paired with white canvas trainers. Summer staple 🌼",
      tags: ["dresses", "skater dress", "floral", "summer"],
      primaryProduct: womenDresses[5] || womenDresses[1],
    },
    {
      category: "dresses",
      userId: "u-neha-verma-008",
      caption: "Shirt dress in breathable cotton poplin with waist belt. Smart & breezy 🍃",
      tags: ["dresses", "shirt dress", "poplin", "minimal"],
      primaryProduct: womenDresses[6] || womenDresses[2],
    },
    {
      category: "dresses",
      userId: "u-priya-patel-005",
      caption: "A-line wrap dress with contrast geometric border print. Modern craft elegance 🌿",
      tags: ["dresses", "wrap dress", "a-line", "craft"],
      primaryProduct: womenDresses[7] || womenDresses[3],
    },

    // 7. COLLEGE OUTFITS (6 posts)
    {
      category: "college outfits",
      userId: "u-neha-verma-008",
      caption: "Oversized college graphic hoodie and relaxed boyfriend denim. Midterms comfort 📚",
      tags: ["college outfits", "campus style", "hoodie", "denim"],
      primaryProduct: womenTops[10] || womenTops[0],
      secondaryProduct: womenBottoms[11] || womenBottoms[0],
    },
    {
      category: "college outfits",
      userId: "u-aditya-rao-009",
      caption: "Tartan plaid casual shirt over white tee and tapered campus trousers 🍂",
      tags: ["college outfits", "tartan", "plaid", "campus style"],
      primaryProduct: menTops[12] || menTops[0],
      secondaryProduct: menBottoms[12] || menBottoms[0],
    },
    {
      category: "college outfits",
      userId: "u-kabir-sen-004",
      caption: "Striped boxy tee with relaxed olive cargo pants. Lecture hall ready 🎒",
      tags: ["college outfits", "striped", "cargos", "campus"],
      primaryProduct: menTops[13] || menTops[1],
      secondaryProduct: menBottoms[13] || menBottoms[1],
    },
    {
      category: "college outfits",
      userId: "u-ananya-sharma-001",
      caption: "Ribbed crop tee with retro high-waist straight fit jeans. Effortless campus vibe ☀️",
      tags: ["college outfits", "ribbed", "straight jeans", "everyday"],
      primaryProduct: womenTops[11] || womenTops[1],
      secondaryProduct: womenBottoms[12] || womenBottoms[1],
    },
    {
      category: "college outfits",
      userId: "u-rohan-mehta-002",
      caption: "Denim overshirt layered over essential white tee with comfortable joggers 🎧",
      tags: ["college outfits", "overshirt", "layering", "library"],
      primaryProduct: menTops[14] || menTops[2],
      secondaryProduct: menBottoms[14] || menBottoms[2],
    },
    {
      category: "college outfits",
      userId: "u-neha-verma-008",
      caption: "Colourblock varsity crewneck styled with pleat tennis skirt 🎾",
      tags: ["college outfits", "varsity", "crewneck", "preppy"],
      primaryProduct: womenTops[12] || womenTops[2],
      secondaryProduct: womenBottoms[13] || womenBottoms[2],
    },
  ];

  for (let i = 0; i < blueprints.length; i++) {
    const bp = blueprints[i];
    const postId = `post-curated-${String(i + 1).padStart(3, "0")}`;

    // Get primary product image
    const primaryImg =
      bp.primaryProduct?.ProductImage?.[0]?.imageUrl ||
      "https://assets.myntassets.com/assets/images/21937170/2023/4/6/f47c6311-a0c6-4731-aaf1-70f7e1efaa4f1680760760890-Stylecast-X-Hersheinbox-Women-Tops-3301680760760518-1.jpg";

    const secondaryImg = bp.secondaryProduct?.ProductImage?.[0]?.imageUrl;

    // Randomize likes between 50 and 5000 deterministically
    const likesCount = Math.floor(50 + ((i * 137 + 89) % 4950));
    const sharesCount = Math.floor(15 + ((i * 47 + 23) % 585));

    // Randomize createdAt over last 7 days (168 hours)
    const hoursAgo = Math.floor(1 + ((i * 3.8 + 2) % 165));
    const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000);

    const price =
      Number(bp.primaryProduct?.currentPrice || 0) +
      Number(bp.secondaryProduct?.currentPrice || 0) ||
      999.0;

    const rating = Math.round((4.2 + ((i * 13) % 8) * 0.1) * 10) / 10;

    // Upsert Post
    const post = await prisma.post.upsert({
      where: { id: postId },
      update: {
        userId: bp.userId,
        caption: bp.caption,
        imageUrl: primaryImg,
        fallbackImageUrl: secondaryImg || primaryImg,
        category: bp.category,
        tags: bp.tags,
        visibility: "PUBLIC",
        price,
        rating,
        likesCount,
        sharesCount,
        createdAt,
      },
      create: {
        id: postId,
        userId: bp.userId,
        caption: bp.caption,
        imageUrl: primaryImg,
        fallbackImageUrl: secondaryImg || primaryImg,
        category: bp.category,
        tags: bp.tags,
        visibility: "PUBLIC",
        price,
        rating,
        likesCount,
        sharesCount,
        createdAt,
      },
    });

    // Tag 1 to 3 products with x/y hotspot percents using upsert
    if (bp.primaryProduct) {
      const isDressOrSaree = bp.category === "dresses" || bp.category === "ethnic wear";
      await prisma.postProduct.upsert({
        where: {
          postId_productId: {
            postId: post.id,
            productId: bp.primaryProduct.id,
          },
        },
        update: {
          xPercent: 50.0,
          yPercent: isDressOrSaree ? 50.0 : 38.0,
          garmentType: isDressOrSaree ? (bp.category === "dresses" ? "dress" : "saree") : "top",
        },
        create: {
          postId: post.id,
          productId: bp.primaryProduct.id,
          xPercent: 50.0,
          yPercent: isDressOrSaree ? 50.0 : 38.0,
          garmentType: isDressOrSaree ? (bp.category === "dresses" ? "dress" : "saree") : "top",
        },
      });
    }

    if (bp.secondaryProduct && bp.secondaryProduct.id !== bp.primaryProduct?.id) {
      await prisma.postProduct.upsert({
        where: {
          postId_productId: {
            postId: post.id,
            productId: bp.secondaryProduct.id,
          },
        },
        update: {
          xPercent: 50.0,
          yPercent: 74.0,
          garmentType: "bottom",
        },
        create: {
          postId: post.id,
          productId: bp.secondaryProduct.id,
          xPercent: 50.0,
          yPercent: 74.0,
          garmentType: "bottom",
        },
      });
    }

    // Seed varied TrendingMetric rows idempotently per post
    const metricData = {
      score: likesCount * 1.5 + sharesCount * 3.0,
      viewsCount: likesCount * 6 + sharesCount * 4,
      likesCount,
      sharesCount,
      tryOnCount: Math.floor(sharesCount * 0.45),
      timeWindow: "24h",
      calculatedAt: new Date(),
    };

    await prisma.trendingMetric.deleteMany({
      where: { postId: post.id, timeWindow: "24h" },
    });

    await prisma.trendingMetric.create({
      data: {
        postId: post.id,
        ...metricData,
      },
    });
  }

  // Deduplicate any legacy duplicate TrendingMetric rows across all posts
  await prisma.$executeRawUnsafe(`
    DELETE FROM "TrendingMetric"
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "postId", "timeWindow" ORDER BY "calculatedAt" DESC, id DESC) as rnum
        FROM "TrendingMetric"
      ) t
      WHERE t.rnum > 1
    );
  `);

  // 5. Create demo try-on session idempotently
  console.log("👗 Creating demo try-on session...");
  await prisma.tryOnSession.upsert({
    where: { id: "tryon-demo-001" },
    update: {},
    create: {
      id: "tryon-demo-001",
      userId: "u-ananya-sharma-001",
      productId: womenTops[0]?.id || 392,
      status: "COMPLETED",
      inputPhotoUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
      renderedImageUrl: "https://assets.myntassets.com/assets/images/21937170/2023/4/6/f47c6311-a0c6-4731-aaf1-70f7e1efaa4f1680760760890-Stylecast-X-Hersheinbox-Women-Tops-3301680760760518-1.jpg",
      fitScore: 94,
      fitNote: "Excellent fit across shoulders (38cm). Bust measurements (86cm) align perfectly with Size S (34in / 86.4cm).",
      sizeSelected: "S",
      isSaved: true,
      isPrivate: false,
    },
  });

  // 6. Pre-warm For You feed cache for demo users (Phase 4)
  console.log("⚡ Pre-warming For You feed cache for demo users...");
  const prewarmUsers = ["u-ananya-sharma-001", "u-rohan-mehta-002", "u-tara-kapoor-003"];
  const prewarmCategories = ["all", "streetwear", "casual", "formal", "ethnic wear", "party wear", "dresses", "college outfits"];

  const prewarmTasks: Promise<any>[] = [];
  for (const userId of prewarmUsers) {
    for (const category of prewarmCategories) {
      prewarmTasks.push(
        computeAndStoreFeed(userId, category).catch((err) =>
          console.warn(`[Seed] Prewarm failed for ${userId}/${category}:`, err.message)
        )
      );
    }
  }
  await Promise.all(prewarmTasks);

  const totalUsers = await prisma.user.count();
  const totalPosts = await prisma.post.count();
  const totalPostProducts = await prisma.postProduct.count();
  const totalMetrics = await prisma.trendingMetric.count();

  console.log(`✅ Seed completed successfully!`);
  console.log(`📊 DB Summary: ${totalUsers} Users, ${totalPosts} Posts, ${totalPostProducts} Tagged Products, ${totalMetrics} Trending Metrics.`);
  return {
    totalUsers,
    totalPosts,
    totalPostProducts,
    totalMetrics,
  };
}

export { main as seedDatabase };

if (process.argv[1]?.includes("seed")) {
  main()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

