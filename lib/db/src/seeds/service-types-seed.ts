import { db } from "../index";
import { serviceTypesTable, type NewServiceType } from "../schema/service-types";

const seed: NewServiceType[] = [
  { name: "身体介護15分", shortLabel: "身体15", category: "body", durationMinutes: 15, color: "#185FA5", sortOrder: 10 },
  { name: "身体介護20分", shortLabel: "身０", category: "body", durationMinutes: 20, color: "#185FA5", sortOrder: 20 },
  { name: "身体介護30分", shortLabel: "身１", category: "body", durationMinutes: 30, color: "#185FA5", sortOrder: 30 },
  { name: "身体介護45分", shortLabel: "身２", category: "body", durationMinutes: 45, color: "#185FA5", sortOrder: 40 },
  { name: "身体介護60分", shortLabel: "身３", category: "body", durationMinutes: 60, color: "#185FA5", sortOrder: 50 },

  { name: "生活援助20分", shortLabel: "生０", category: "life", durationMinutes: 20, color: "#0F6E56", sortOrder: 110 },
  { name: "生活援助30分", shortLabel: "生１", category: "life", durationMinutes: 30, color: "#0F6E56", sortOrder: 120 },
  { name: "生活援助45分", shortLabel: "生２", category: "life", durationMinutes: 45, color: "#0F6E56", sortOrder: 130 },
  { name: "生活援助60分", shortLabel: "生３", category: "life", durationMinutes: 60, color: "#0F6E56", sortOrder: 140 },

  { name: "入浴介助45分", shortLabel: "入浴", category: "bathing", durationMinutes: 45, color: "#534AB7", sortOrder: 200 },
  { name: "入浴介助60分", shortLabel: "入浴60", category: "bathing", durationMinutes: 60, color: "#534AB7", sortOrder: 210 },

  { name: "排泄介助15分", shortLabel: "排泄", category: "toileting", durationMinutes: 15, color: "#BA7517", sortOrder: 300 },
  { name: "排泄介助20分", shortLabel: "排泄20", category: "toileting", durationMinutes: 20, color: "#BA7517", sortOrder: 310 },

  { name: "食事介助30分", shortLabel: "食介", category: "meal", durationMinutes: 30, color: "#D85A30", sortOrder: 400 },
  { name: "食事介助60分", shortLabel: "食介60", category: "meal", durationMinutes: 60, color: "#D85A30", sortOrder: 410 },

  { name: "掃除・洗濯30分", shortLabel: "掃・洗", category: "cleaning", durationMinutes: 30, color: "#5DCAA5", sortOrder: 500 },
  { name: "通院介助・代行30分", shortLabel: "代行", category: "accompaniment", durationMinutes: 30, color: "#D4537E", sortOrder: 600 },
];

async function run() {
  for (const s of seed) {
    await db.insert(serviceTypesTable).values(s).onConflictDoNothing();
  }
  console.log(`Seeded ${seed.length} service types`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
