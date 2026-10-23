import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { CAMPUS_LANDMARKS } from "./data/campus-landmarks.js";

const prisma = new PrismaClient();

// Shared demo password for all seed users (real accounts never share one).
const DEMO_PASSWORD = "password123";

// Nigerian restaurants + dishes so the app looks alive for a demo.
const RESTAURANTS = [
  {
    name: "Mama Put Kitchen",
    description: "Authentic home-style Nigerian meals, made fresh daily.",
    address: "12 Adeniran Ogunsanya St, Surulere, Lagos",
    phone: "+234 801 234 5678",
    menuItems: [
      { name: "Jollof Rice & Chicken", description: "Smoky party jollof with a grilled chicken thigh", price: 4500, category: "Main Course" },
      { name: "Fried Rice", description: "Vegetable fried rice with liver and prawns", price: 3500, category: "Main Course" },
      { name: "Egusi Soup & Pounded Yam", description: "Ground melon soup with assorted meat", price: 5000, category: "Soup" },
      { name: "White Rice & Stew", description: "Steamed rice with rich tomato stew", price: 3000, category: "Main Course" },
      { name: "Moi Moi", description: "Steamed bean pudding with egg and fish", price: 1500, category: "Side" },
      { name: "Catfish Pepper Soup", description: "Spicy, aromatic catfish broth", price: 4000, category: "Soup" },
    ],
  },
  {
    name: "Lekki Grills & Suya",
    description: "Charcoal-grilled meats and classic suya, open late.",
    address: "5 Admiralty Way, Lekki Phase 1, Lagos",
    phone: "+234 802 345 6789",
    menuItems: [
      { name: "Beef Suya", description: "Spiced, skewered beef with yaji", price: 2500, category: "Grills" },
      { name: "Chicken Suya", description: "Char-grilled chicken skewers", price: 3000, category: "Grills" },
      { name: "Grilled Croaker Fish", description: "Whole croaker with pepper sauce", price: 6000, category: "Grills" },
      { name: "BBQ Chicken", description: "Half chicken, smoky BBQ glaze", price: 5500, category: "Grills" },
      { name: "Asun", description: "Spicy grilled goat meat", price: 4500, category: "Grills" },
      { name: "Boli & Groundnut", description: "Grilled plantain with roasted peanuts", price: 1200, category: "Side" },
    ],
  },
  {
    name: "Abuja Buka",
    description: "Northern Nigerian delicacies from the capital.",
    address: "8 Aminu Kano Cres, Wuse 2, Abuja",
    phone: "+234 803 456 7890",
    menuItems: [
      { name: "Tuwo Shinkafa & Miyan Kuka", description: "Soft rice swallow with baobab-leaf soup", price: 4000, category: "Main Course" },
      { name: "Nkwobi", description: "Spicy cow foot in palm-oil sauce", price: 3500, category: "Main Course" },
      { name: "Beef Pepper Soup", description: "Hot, peppery beef broth", price: 3800, category: "Soup" },
      { name: "Yam Porridge (Asaro)", description: "Savoury mashed yam with palm oil", price: 2500, category: "Main Course" },
      { name: "Kilishi", description: "Dried, spiced beef jerky", price: 2000, category: "Snack" },
      { name: "Danwake", description: "Bean dumplings with pepper and oil", price: 1800, category: "Main Course" },
    ],
  },
];

async function main() {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Campus (idempotent; the migration also creates Main Campus) ──
  // Prefer an explicit name, then the existing campus, then create one. This
  // avoids creating a duplicate "Main Campus" when the live DB already has a
  // named campus such as "Redeemers University".
  let campus = await prisma.campus.findFirst({
    where: { name: process.env.SEED_CAMPUS_NAME || "Main Campus" },
  });
  if (!campus) {
    campus = await prisma.campus.findFirst({ orderBy: { id: "asc" } });
  }
  if (!campus) {
    campus = await prisma.campus.create({ data: { name: "Main Campus", address: "Lagos, Nigeria" } });
  }

  // ── Campus landmarks (names first; coordinates may be filled in later) ──
  let landmarksWithCoords = 0;
  for (const landmark of CAMPUS_LANDMARKS) {
    const hasCoords = landmark.lat != null && landmark.lng != null;
    if (hasCoords) landmarksWithCoords += 1;

    await prisma.campusLandmark.upsert({
      where: { campusId_name: { campusId: campus.id, name: landmark.name } },
      update: {
        category: landmark.category,
        aliases: landmark.aliases ?? [],
        sortOrder: landmark.sortOrder ?? 0,
        isActive: true,
        // Never erase manually collected coordinates with a null seed value.
        ...(hasCoords ? { lat: landmark.lat, lng: landmark.lng } : {}),
      },
      create: {
        campusId: campus.id,
        name: landmark.name,
        category: landmark.category,
        aliases: landmark.aliases ?? [],
        lat: landmark.lat ?? null,
        lng: landmark.lng ?? null,
        sortOrder: landmark.sortOrder ?? 0,
      },
    });
  }

  // ── Super admin (global; no campus) ──
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@chowzilla.com" },
    update: {},
    create: { name: "ChowZilla Admin", email: "admin@chowzilla.com", password, role: "SUPER_ADMIN" },
  });

  // ── Users (upsert on unique email → safe to re-run) ──
  const owner = await prisma.user.upsert({
    where: { email: "owner@chowzilla.com" },
    update: {}, // already exists → leave it (don't reset a changed password)
    create: { name: "Ada Obi", email: "owner@chowzilla.com", password, role: "OWNER" },
  });

  const customer = await prisma.user.upsert({
    where: { email: "customer@chowzilla.com" },
    update: {},
    create: { name: "Chinedu Eze", email: "customer@chowzilla.com", password, role: "CUSTOMER", phone: "+234 801 000 0001" },
  });

  const riderUser = await prisma.user.upsert({
    where: { email: "rider@chowzilla.com" },
    update: {},
    create: { name: "Tunde Bakare", email: "rider@chowzilla.com", password, role: "RIDER", phone: "+234 801 000 0002" },
  });

  // ── Rider profile (unique userId → upsert) ──
  await prisma.rider.upsert({
    where: { userId: riderUser.id },
    // Demo riders must be verified, otherwise /riders/available-orders hides
    // the queue and the accept endpoint rejects every order in development.
    update: { isVerified: true },
    create: {
      userId: riderUser.id,
      vehicleType: "Motorcycle",
      licenseNumber: "LAG-12345",
      matricNumber: "RID-001",
      campusId: campus.id,
      isVerified: true,
    },
  });

  // ── Restaurants + menu items ──
  // Restaurant/MenuItem have no unique field, so guard with findFirst to stay idempotent.
  for (const r of RESTAURANTS) {
    let restaurant = await prisma.restaurant.findFirst({ where: { name: r.name } });
    if (!restaurant) {
      restaurant = await prisma.restaurant.create({
        data: {
          name: r.name,
          description: r.description,
          address: r.address,
          phone: r.phone,
          imageUrl: "",
          ownerId: owner.id,
          campusId: campus.id,
          approvalStatus: "APPROVED",
        },
      });
    }

    for (const item of r.menuItems) {
      const existing = await prisma.menuItem.findFirst({
        where: { restaurantId: restaurant.id, name: item.name },
      });
      if (!existing) {
        await prisma.menuItem.create({
          data: {
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            imageUrl: "",
            restaurantId: restaurant.id,
          },
        });
      }
    }
  }

  console.log("Seed complete ✅");
  console.log(`  Campus:   ${campus.name}`);
  console.log(`  Landmarks: ${CAMPUS_LANDMARKS.length} (${landmarksWithCoords} with coordinates)`);
  console.log(`  Admin:    ${superAdmin.email} / ${DEMO_PASSWORD}`);
  console.log(`  Owner:    ${owner.email} / ${DEMO_PASSWORD}`);
  console.log(`  Customer: ${customer.email} / ${DEMO_PASSWORD}`);
  console.log(`  Rider:    ${riderUser.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
