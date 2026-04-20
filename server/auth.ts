import { db } from "./db";
import {
  users, matters, matterInventors, conceptionNarratives,
  claimElements, inventorshipDisputes, priorArtReferences,
  inventionRecords, provenanceLedger,
} from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";

// ── Demo account ─────────────────────────────────────────────────────────────
// A shared demo account that anyone can use to evaluate the application
// without registering. All data created while signed in as the demo user is
// wiped on the next demo sign-in and on logout, so each demo session starts
// from a clean slate.
export const DEMO_EMAIL    = "demo@inventorlab.com";
export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_FULLNAME = "Demo Inventor";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export function requireCounsel(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!["counsel","admin"].includes(req.session?.userRole ?? "")) {
    return res.status(403).json({ error: "Counsel access required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (req.session?.userRole !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/**
 * Ensure the shared demo user exists and return it. The password hash is
 * refreshed on every call so that the demo credentials always work even if
 * an operator has manually rotated them in the database.
 */
export async function ensureDemoUser() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) {
    await db.update(users)
      .set({ passwordHash, fullName: DEMO_FULLNAME, role: "inventor" })
      .where(eq(users.id, existing.id));
    return { ...existing, passwordHash, fullName: DEMO_FULLNAME, role: "inventor" };
  }
  const [created] = await db.insert(users).values({
    email: DEMO_EMAIL,
    fullName: DEMO_FULLNAME,
    role: "inventor",
    passwordHash,
    tenantId: 1,
  }).returning();
  return created;
}

/**
 * Delete every record created by the demo user. This is invoked when the
 * demo user signs in (so prior sessions are wiped) and when the demo user
 * logs out, satisfying the "input is cleared at timeout or logout"
 * requirement for the demo account.
 */
export async function wipeDemoData(demoUserId: number) {
  const ownedMatters = await db
    .select({ id: matters.id })
    .from(matters)
    .where(eq(matters.createdById, demoUserId));
  const matterIds = ownedMatters.map((m) => m.id);

  if (matterIds.length) {
    await db.delete(provenanceLedger).where(inArray(provenanceLedger.matterId, matterIds));
    await db.delete(inventionRecords).where(inArray(inventionRecords.matterId, matterIds));
    await db.delete(priorArtReferences).where(inArray(priorArtReferences.matterId, matterIds));
    await db.delete(inventorshipDisputes).where(inArray(inventorshipDisputes.matterId, matterIds));
    await db.delete(claimElements).where(inArray(claimElements.matterId, matterIds));
    await db.delete(conceptionNarratives).where(inArray(conceptionNarratives.matterId, matterIds));
    await db.delete(matterInventors).where(inArray(matterInventors.matterId, matterIds));
    await db.delete(matters).where(inArray(matters.id, matterIds));
  }

  // Also clean up any stray inventor/narrative rows linked directly to the
  // demo user (e.g. on matters they were added to but did not create).
  await db.delete(matterInventors).where(eq(matterInventors.userId, demoUserId));
  await db.delete(conceptionNarratives).where(eq(conceptionNarratives.inventorId, demoUserId));
}

export function isDemoUser(email?: string | null): boolean {
  return !!email && email.toLowerCase() === DEMO_EMAIL;
}

declare module "express-session" {
  interface SessionData {
    userId:   number;
    userRole: string;
    tenantId: number;
    email:    string;
  }
}
