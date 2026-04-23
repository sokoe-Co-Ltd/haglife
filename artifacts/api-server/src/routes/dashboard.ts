import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import {
  db,
  residentsTable,
  vitalsTable,
  mealsTable,
  handoverNotesTable,
  eliminationsTable,
  weightsTable,
  eliminationRoundChecksTable,
  eliminationRoundStateTable,
} from "@workspace/db";

const router: IRouter = Router();

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function thisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

router.get("/dashboard/today", async (req, res): Promise<void> => {
  const { start, end } = todayRange();
  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true));
  const todayVitals = await db
    .select()
    .from(vitalsTable)
    .where(and(gte(vitalsTable.recordedAt, start), lte(vitalsTable.recordedAt, end)));
  const todayMeals = await db
    .select()
    .from(mealsTable)
    .where(and(gte(mealsTable.recordedAt, start), lte(mealsTable.recordedAt, end)));
  const recentHandover = await db
    .select()
    .from(handoverNotesTable)
    .orderBy(desc(handoverNotesTable.recordedAt))
    .limit(5);

  const vitalsRecordedIds = new Set(todayVitals.map(v => v.residentId));
  const vitalsNeedRecheckCount = todayVitals.filter(v => v.needsRecheck).length;
  const breakfastIds = new Set(todayMeals.filter(m => m.mealType === "朝食").map(m => m.residentId));
  const lunchIds = new Set(todayMeals.filter(m => m.mealType === "昼食").map(m => m.residentId));
  const dinnerIds = new Set(todayMeals.filter(m => m.mealType === "夕食").map(m => m.residentId));

  const todayHandover = await db
    .select()
    .from(handoverNotesTable)
    .where(and(gte(handoverNotesTable.recordedAt, start), lte(handoverNotesTable.recordedAt, end)));

  res.json({
    date: new Date().toISOString().split("T")[0],
    totalResidents: residents.length,
    vitalsRecordedCount: vitalsRecordedIds.size,
    vitalsMissingCount: residents.length - vitalsRecordedIds.size,
    vitalsNeedRecheckCount,
    mealsRecordedBreakfastCount: breakfastIds.size,
    mealsRecordedLunchCount: lunchIds.size,
    mealsRecordedDinnerCount: dinnerIds.size,
    mealsMissingCount: residents.length - lunchIds.size,
    eliminationAlertCount: 0,
    handoverCount: todayHandover.length,
    recentHandoverNotes: recentHandover,
  });
});

router.get("/dashboard/alerts", async (req, res): Promise<void> => {
  const { start, end } = todayRange();
  const monthRange = thisMonthRange();

  const residents = await db
    .select()
    .from(residentsTable)
    .where(eq(residentsTable.isVisible, true))
    .orderBy(residentsTable.roomNumber);

  // Vitals needing recheck today
  const todayVitals = await db
    .select()
    .from(vitalsTable)
    .where(and(gte(vitalsTable.recordedAt, start), lte(vitalsTable.recordedAt, end)));

  const vitalsNeedingRecheck = residents
    .map(r => {
      const resVitals = todayVitals.filter(v => v.residentId === r.id);
      const latest = resVitals.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
      return {
        residentId: r.id,
        residentName: `${r.lastName}${r.firstName}`,
        roomNumber: r.roomNumber,
        photoUrl: r.photoUrl ?? null,
        latestVital: latest ? { ...latest, temperature: latest.temperature ? parseFloat(String(latest.temperature)) : null } : null,
        needsRecheck: latest?.needsRecheck ?? false,
        recordedToday: resVitals.length > 0,
      };
    })
    .filter(r => r.needsRecheck);

  // Elimination needing attention
  const [state] = await db.select().from(eliminationRoundStateTable).orderBy(desc(eliminationRoundStateTable.lastResetAt)).limit(1);
  const resetAt = state?.lastResetAt ?? new Date(0);
  const roundChecks = await db
    .select()
    .from(eliminationRoundChecksTable)
    .where(and(eq(eliminationRoundChecksTable.isActive, true), gte(eliminationRoundChecksTable.checkedAt, resetAt)));
  const allBm = await db
    .select()
    .from(eliminationsTable)
    .where(eq(eliminationsTable.type, "便"))
    .orderBy(desc(eliminationsTable.recordedAt));
  const lastBmMap = new Map<number, Date>();
  for (const e of allBm) {
    if (!lastBmMap.has(e.residentId)) lastBmMap.set(e.residentId, e.recordedAt);
  }
  const now = new Date();
  const eliminationNeedingAttention = residents
    .map(r => {
      const lastBm = lastBmMap.get(r.id);
      const daysSinceLastBm = lastBm ? Math.floor((now.getTime() - lastBm.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const checkedThisRound = roundChecks.some(c => c.residentId === r.id);
      const needsAttention = !r.stomaManagement && (daysSinceLastBm === null || daysSinceLastBm >= 3);
      return {
        residentId: r.id,
        residentName: `${r.lastName}${r.firstName}`,
        roomNumber: r.roomNumber,
        photoUrl: r.photoUrl ?? null,
        stomaManagement: r.stomaManagement,
        lastBmRecordedAt: lastBm ? lastBm.toISOString() : null,
        daysSinceLastBm,
        checkedThisRound,
        needsAttention,
      };
    })
    .filter(r => r.needsAttention);

  // Weights not recorded this month
  const monthWeights = await db
    .select()
    .from(weightsTable)
    .where(and(gte(weightsTable.recordedAt, monthRange.start), lte(weightsTable.recordedAt, monthRange.end)));
  const weightsNotRecordedThisMonth = residents
    .map(r => {
      const resWeights = monthWeights.filter(w => w.residentId === r.id);
      const latest = resWeights.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())[0];
      return {
        residentId: r.id,
        residentName: `${r.lastName}${r.firstName}`,
        roomNumber: r.roomNumber,
        photoUrl: r.photoUrl ?? null,
        latestWeight: latest ? parseFloat(String(latest.weightKg)) : null,
        recordedThisMonth: resWeights.length > 0,
        lastRecordedAt: latest ? latest.recordedAt.toISOString() : null,
      };
    })
    .filter(r => !r.recordedThisMonth);

  // Map field names to match frontend expectations
  const vitalAlerts = vitalsNeedingRecheck.map(r => ({ ...r, daysSince: null }));
  const eliminationAlerts = eliminationNeedingAttention.map(r => ({
    ...r,
    daysSince: r.daysSinceLastBm,
  }));

  res.json({
    vitalsNeedingRecheck,
    eliminationNeedingAttention,
    weightsNotRecordedThisMonth,
    vitalAlerts,
    eliminationAlerts,
  });
});

export default router;
