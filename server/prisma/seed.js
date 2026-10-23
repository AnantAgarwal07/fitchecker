"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Starting FitsYou database seed...");
    // Verify Product and ProductImage exist
    const productCount = await prisma.product.count();
    const imageCount = await prisma.productImage.count();
    console.log(`📦 Verified existing catalog: ${productCount} products, ${imageCount} images.`);
    if (productCount === 0) {
        throw new Error("No products found in database! Aborting seed.");
    }
    // 1. Create 3 Test Users with Body Profiles
    console.log("👤 Creating test users and body profiles...");
    const user1 = await prisma.user.upsert({
        where: { email: "ananya@example.com" },
        update: {},
        create: {
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
                create: {
                    heightCm: 165,
                    gender: "women",
                    bodyType: "hourglass",
                    bustChestCm: 86,
                    waistCm: 68,
                    hipsCm: 94,
                    inseamCm: 76,
                    shoulderCm: 38,
                    fitPreference: "fitted",
                    styleVibe: "streetwear",
                    fullBodyPhotoUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80"
                }
            }
        }
    });
    const user2 = await prisma.user.upsert({
        where: { email: "rohan@example.com" },
        update: {},
        create: {
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
                create: {
                    heightCm: 180,
                    gender: "men",
                    bodyType: "athletic",
                    bustChestCm: 102,
                    waistCm: 81,
                    hipsCm: 98,
                    inseamCm: 82,
                    shoulderCm: 45,
                    fitPreference: "regular",
                    styleVibe: "classic",
                    fullBodyPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80"
                }
            }
        }
    });
    const user3 = await prisma.user.upsert({
        where: { email: "tara@example.com" },
        update: {},
        create: {
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
                create: {
                    heightCm: 170,
                    gender: "women",
                    bodyType: "rectangle",
                    bustChestCm: 88,
                    waistCm: 72,
                    hipsCm: 96,
                    inseamCm: 79,
                    shoulderCm: 40,
                    fitPreference: "relaxed",
                    styleVibe: "ethnic",
                    fullBodyPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80"
                }
            }
        }
    });
    // Follow connections
    await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: user1.id, followingId: user2.id } },
        update: {},
        create: { followerId: user1.id, followingId: user2.id }
    });
    await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: user2.id, followingId: user3.id } },
        update: {},
        create: { followerId: user2.id, followingId: user3.id }
    });
    await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: user3.id, followingId: user1.id } },
        update: {},
        create: { followerId: user3.id, followingId: user1.id }
    });
    // 2. Create 10 Demo Posts linked to real products
    console.log("📸 Creating 10 demo posts linked to real catalog products...");
    const demoPosts = [
        {
            id: "post-demo-001",
            userId: user1.id,
            caption: "Graphic crop top paired with high-waist palazzos for an effortless sunny day vibe ✨",
            imageUrl: "https://assets.myntassets.com/assets/images/21937170/2023/4/6/f47c6311-a0c6-4731-aaf1-70f7e1efaa4f1680760760890-Stylecast-X-Hersheinbox-Women-Tops-3301680760760518-1.jpg",
            category: "casual",
            tags: ["crop top", "summer fit", "palazzos", "casual"],
            price: 1233.00,
            rating: 4.6,
            likesCount: 284,
            sharesCount: 42,
            products: [
                { productId: 392, xPercent: 50.0, yPercent: 35.0, garmentType: "top" },
                { productId: 9, xPercent: 50.0, yPercent: 75.0, garmentType: "bottom" }
            ]
        },
        {
            id: "post-demo-002",
            userId: user2.id,
            caption: "Checked blue slim fit shirt on cotton trousers. Classic office-to-dinner transition ☕",
            imageUrl: "https://assets.myntassets.com/assets/images/17655282/2022/3/28/bfdd2d07-0266-447b-b704-ddb182228bad1648468929143KETCHMenBlueSlimFitCheckedCasualShirt1.jpg",
            category: "formal",
            tags: ["menswear", "checked shirt", "smart casual"],
            price: 469.00,
            rating: 4.5,
            likesCount: 412,
            sharesCount: 67,
            products: [
                { productId: 662, xPercent: 50.0, yPercent: 40.0, garmentType: "top" }
            ]
        },
        {
            id: "post-demo-003",
            userId: user3.id,
            caption: "Nothing beats the timeless elegance of Bandhani gotta patti saree for festive evenings 🪔",
            imageUrl: "https://assets.myntassets.com/assets/images/14088708/2021/7/9/10b2b71e-28df-4e3e-ac4a-d813495718dc1625827234204-Vastranand-Poly-Chiffon-Printed-Bandhani-Gota-Patti-Pearls-L-1.jpg",
            category: "ethnic wear",
            tags: ["saree", "bandhani", "festive", "traditional"],
            price: 5700.00,
            rating: 4.8,
            likesCount: 630,
            sharesCount: 118,
            products: [
                { productId: 4, xPercent: 50.0, yPercent: 50.0, garmentType: "saree" }
            ]
        },
        {
            id: "post-demo-004",
            userId: user1.id,
            caption: "Oversized graphic tee with chunky sneaks. Streetwear Sunday mood ⚡",
            imageUrl: "https://assets.myntassets.com/assets/images/21440734/2023/4/14/719b62cb-dfaf-4785-96a4-e5762007a7431681474236473-Kook-N-Keech-Women-Tshirts-4641681474235929-1.jpg",
            category: "streetwear",
            tags: ["oversized", "graphic tee", "streetwear"],
            price: 417.00,
            rating: 4.4,
            likesCount: 350,
            sharesCount: 55,
            products: [
                { productId: 82, xPercent: 50.0, yPercent: 45.0, garmentType: "top" }
            ]
        },
        {
            id: "post-demo-005",
            userId: user2.id,
            caption: "Crisp white shirt is a non-negotiable wardrobe staple. Light, breathable, sharp 🤍",
            imageUrl: "https://assets.myntassets.com/assets/images/17666710/2022/3/29/a499bdde-0cf8-41e7-9255-34b6e5c874621648539314598CantabilMenWhiteOriginalSemiSheerCasualShirt1.jpg",
            category: "casual",
            tags: ["white shirt", "linen feel", "minimalist"],
            price: 747.00,
            rating: 4.7,
            likesCount: 220,
            sharesCount: 31,
            products: [
                { productId: 664, xPercent: 50.0, yPercent: 42.0, garmentType: "top" }
            ]
        },
        {
            id: "post-demo-006",
            userId: user3.id,
            caption: "Linen blend Chanderi saree in soft pink & mustard. Understated luxury at its finest ✨",
            imageUrl: "https://assets.myntassets.com/assets/images/12017348/2020/7/30/fa202a41-4702-472f-80b0-54ffd4e617191596117651330CoffeeYellowPanKalamkariPatolaPrintsoftManipuriSilksaree1.jpg",
            category: "ethnic wear",
            tags: ["chanderi", "handloom", "saree love"],
            price: 3475.00,
            rating: 4.9,
            likesCount: 512,
            sharesCount: 89,
            products: [
                { productId: 394, xPercent: 50.0, yPercent: 48.0, garmentType: "saree" }
            ]
        },
        {
            id: "post-demo-007",
            userId: user1.id,
            caption: "Wrap crop top with contrast piping. Saturday night ready 🪩",
            imageUrl: "https://assets.myntassets.com/assets/images/15953946/2022/10/18/42f4bc4d-5d69-4f94-b4a7-03b6b58d3b0a1666071953627TokyoTalkiesGreenKeyholeNeckWrapCropTop2.jpg",
            category: "party wear",
            tags: ["night out", "wrap top", "glam"],
            price: 1214.00,
            rating: 4.6,
            likesCount: 478,
            sharesCount: 74,
            products: [
                { productId: 22, xPercent: 50.0, yPercent: 40.0, garmentType: "top" },
                { productId: 16, xPercent: 50.0, yPercent: 78.0, garmentType: "bottom" }
            ]
        },
        {
            id: "post-demo-008",
            userId: user2.id,
            caption: "Rust pathani kurta for family puja. Clean tailoring and traditional vibes 🪔",
            imageUrl: "https://assets.myntassets.com/assets/images/15465822/2021/9/15/7c377275-be11-46b1-9dde-34ca9e29cb541631711921042indusroutebyPantaloonsMenRustThreadWorkPathaniKurta1.jpg",
            category: "ethnic wear",
            tags: ["pathani", "mens ethnic", "festive"],
            price: 699.00,
            rating: 4.5,
            likesCount: 388,
            sharesCount: 52,
            products: [
                { productId: 11, xPercent: 50.0, yPercent: 45.0, garmentType: "top" }
            ]
        },
        {
            id: "post-demo-009",
            userId: user3.id,
            caption: "Navy blue fit-and-flare dress. The easiest brunch outfit to throw on and go 🥐",
            imageUrl: "https://assets.myntassets.com/assets/images/15691182/2021/10/1/bd2e4631-f268-43a9-9238-2704e3bd6a501633070422914ATUNNavyBlueDress1.jpg",
            category: "dresses",
            tags: ["dress", "brunch fit", "navy blue"],
            price: 899.00,
            rating: 4.3,
            likesCount: 295,
            sharesCount: 38,
            products: [
                { productId: 24, xPercent: 50.0, yPercent: 50.0, garmentType: "dress" }
            ]
        },
        {
            id: "post-demo-010",
            userId: user2.id,
            caption: "Tartan checks and coffee run. Autumn layering done right 🍂",
            imageUrl: "https://assets.myntassets.com/assets/images/15488894/2022/4/8/3fccb924-6a40-43df-904a-646154761b451649398992356IndianTerrainMenBeigeUrbanTaperedFitSelf-DesignTrousersShirt1.jpg",
            category: "college outfits",
            tags: ["tartan", "plaid", "campus style"],
            price: 944.00,
            rating: 4.6,
            likesCount: 198,
            sharesCount: 24,
            products: [
                { productId: 12, xPercent: 50.0, yPercent: 42.0, garmentType: "top" }
            ]
        }
    ];
    for (const postData of demoPosts) {
        const { products, ...postFields } = postData;
        const post = await prisma.post.upsert({
            where: { id: postFields.id },
            update: {},
            create: postFields
        });
        for (const prod of products) {
            await prisma.postProduct.create({
                data: {
                    postId: post.id,
                    productId: prod.productId,
                    xPercent: prod.xPercent,
                    yPercent: prod.yPercent,
                    garmentType: prod.garmentType
                }
            });
        }
        // Add trending metric for each post
        await prisma.trendingMetric.create({
            data: {
                postId: post.id,
                score: postFields.likesCount * 1.5 + postFields.sharesCount * 3.0,
                viewsCount: postFields.likesCount * 8,
                likesCount: postFields.likesCount,
                sharesCount: postFields.sharesCount,
                tryOnCount: Math.floor(postFields.sharesCount / 2),
                timeWindow: "24h"
            }
        });
    }
    // 3. Create 1 sample TryOnSession
    console.log("👗 Creating demo try-on session...");
    await prisma.tryOnSession.upsert({
        where: { id: "tryon-demo-001" },
        update: {},
        create: {
            id: "tryon-demo-001",
            userId: user1.id,
            productId: 392,
            status: "COMPLETED",
            inputPhotoUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
            renderedImageUrl: "https://assets.myntassets.com/assets/images/21937170/2023/4/6/f47c6311-a0c6-4731-aaf1-70f7e1efaa4f1680760760890-Stylecast-X-Hersheinbox-Women-Tops-3301680760760518-1.jpg",
            fitScore: 94,
            fitNote: "Excellent fit across shoulders (38cm). Bust measurements (86cm) align perfectly with Size S (34in / 86.4cm).",
            sizeSelected: "S",
            isSaved: true,
            isPrivate: false,
            renderJobs: {
                create: {
                    modelName: "gemini-2.5-flash-image",
                    status: "COMPLETED",
                    promptUsed: "Virtual try-on of Stylecast Graphic Crop Top on user photo",
                    durationMs: 3420,
                    startedAt: new Date(Date.now() - 60000),
                    completedAt: new Date()
                }
            }
        }
    });
    console.log("✅ Seed completed successfully!");
}
main()
    .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
