var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index-prod.ts
import fs from "node:fs";
import path from "node:path";
import express2 from "express";

// server/app.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  demons: () => demons,
  demonsRelations: () => demonsRelations,
  insertDemonSchema: () => insertDemonSchema,
  insertRecordSchema: () => insertRecordSchema,
  records: () => records,
  recordsRelations: () => recordsRelations,
  sessions: () => sessions,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isModerator: boolean("is_moderator").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var demons = pgTable("demons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  creator: text("creator").notNull(),
  verifier: text("verifier"),
  verifierId: varchar("verifier_id").references(() => users.id, { onDelete: "set null" }),
  // Track which user verified it
  difficulty: varchar("difficulty", { length: 50 }).notNull(),
  // Easy, Medium, Hard, Insane, Extreme
  position: integer("position").notNull().unique(),
  points: integer("points").notNull(),
  videoUrl: text("video_url"),
  completionCount: integer("completion_count").notNull().default(0),
  listType: varchar("list_type", { length: 50 }).notNull().default("demonlist"),
  // demonlist, challenge, unrated, upcoming
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertDemonSchema = createInsertSchema(demons).omit({
  id: true,
  completionCount: true,
  createdAt: true,
  updatedAt: true
}).extend({
  difficulty: z.enum(["Easy", "Medium", "Hard", "Insane", "Extreme"]),
  position: z.number().int().positive(),
  points: z.number().int().positive(),
  listType: z.enum(["demonlist", "challenge", "unrated", "upcoming"]).default("demonlist")
});
var records = pgTable("records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  demonId: varchar("demon_id").notNull().references(() => demons.id, { onDelete: "cascade" }),
  videoUrl: text("video_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // pending, approved, rejected
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id)
});
var insertRecordSchema = createInsertSchema(records).omit({
  id: true,
  userId: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedBy: true
}).extend({
  videoUrl: z.string().url("Must be a valid URL")
});
var usersRelations = relations(users, ({ many }) => ({
  records: many(records)
}));
var demonsRelations = relations(demons, ({ many }) => ({
  records: many(records)
}));
var recordsRelations = relations(records, ({ one }) => ({
  user: one(users, {
    fields: [records.userId],
    references: [users.id]
  }),
  demon: one(demons, {
    fields: [records.demonId],
    references: [demons.id]
  }),
  reviewer: one(users, {
    fields: [records.reviewedBy],
    references: [users.id]
  })
}));

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, desc, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations (Required for Replit Auth)
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async getAllUsers() {
    return await db.select().from(users);
  }
  async updateUserProfile(userId, username) {
    const [user] = await db.update(users).set({ username, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)).returning();
    return user;
  }
  // Demon operations
  async getAllDemons(listType) {
    if (listType && listType !== "all") {
      return await db.select().from(demons).where(eq(demons.listType, listType)).orderBy(demons.position);
    }
    return await db.select().from(demons).orderBy(demons.position);
  }
  async getDemon(id) {
    const [demon] = await db.select().from(demons).where(eq(demons.id, id));
    return demon;
  }
  async createDemon(demonData) {
    const [demon] = await db.insert(demons).values(demonData).returning();
    return demon;
  }
  async updateDemon(id, demonData) {
    const [demon] = await db.update(demons).set({ ...demonData, updatedAt: /* @__PURE__ */ new Date() }).where(eq(demons.id, id)).returning();
    return demon;
  }
  async deleteDemon(id) {
    await db.delete(demons).where(eq(demons.id, id));
  }
  async reorderDemons(demonOrder, listType) {
    const calculatePoints = (position) => {
      if (position < 1 || position > 200) return 0;
      if (position === 1) return 300;
      if (position === 200) return 1;
      const points = 300 - (position - 1) * 299 / 199;
      return Math.round(points);
    };
    for (let i = 0; i < demonOrder.length; i++) {
      await db.update(demons).set({
        position: -(i + 1),
        // Temporary negative position: -1, -2, -3, etc.
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(demons.id, demonOrder[i].id));
    }
    for (const { id, position } of demonOrder) {
      const points = calculatePoints(position);
      await db.update(demons).set({
        position,
        points,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(demons.id, id));
    }
  }
  // Record operations
  async getAllRecords() {
    const result = await db.select({
      id: records.id,
      userId: records.userId,
      demonId: records.demonId,
      videoUrl: records.videoUrl,
      status: records.status,
      submittedAt: records.submittedAt,
      reviewedAt: records.reviewedAt,
      reviewedBy: records.reviewedBy,
      user: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl
      },
      demon: {
        id: demons.id,
        name: demons.name,
        position: demons.position,
        difficulty: demons.difficulty,
        points: demons.points
      }
    }).from(records).leftJoin(users, eq(records.userId, users.id)).leftJoin(demons, eq(records.demonId, demons.id)).orderBy(desc(records.submittedAt));
    return result;
  }
  async getRecordsByUser(userId) {
    return await db.select().from(records).where(eq(records.userId, userId)).orderBy(desc(records.submittedAt));
  }
  async getApprovedRecordsByDemon(demonId) {
    return await db.select({
      id: records.id,
      userId: records.userId,
      demonId: records.demonId,
      videoUrl: records.videoUrl,
      status: records.status,
      submittedAt: records.submittedAt,
      reviewedAt: records.reviewedAt,
      user: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl
      }
    }).from(records).leftJoin(users, eq(records.userId, users.id)).where(eq(records.status, "approved") && eq(records.demonId, demonId)).orderBy(desc(records.submittedAt));
  }
  async createRecord(userId, recordData) {
    const [record] = await db.insert(records).values({
      ...recordData,
      userId,
      status: "pending"
    }).returning();
    return record;
  }
  async approveRecord(recordId, reviewerId) {
    const [record] = await db.select().from(records).where(eq(records.id, recordId));
    if (!record) {
      throw new Error("Record not found");
    }
    await db.update(records).set({
      status: "approved",
      reviewedAt: /* @__PURE__ */ new Date(),
      reviewedBy: reviewerId
    }).where(eq(records.id, recordId));
    await db.update(demons).set({
      completionCount: sql2`${demons.completionCount} + 1`
    }).where(eq(demons.id, record.demonId));
  }
  async rejectRecord(recordId, reviewerId) {
    await db.update(records).set({
      status: "rejected",
      reviewedAt: /* @__PURE__ */ new Date(),
      reviewedBy: reviewerId
    }).where(eq(records.id, recordId));
  }
  // Leaderboard operations
  async getLeaderboard() {
    const allUsers = await db.select().from(users);
    const leaderboard = await Promise.all(allUsers.map(async (user) => {
      const completionResult = await db.select({
        points: sql2`COALESCE(SUM(${demons.points}), 0)`,
        completions: sql2`COUNT(${records.id})`
      }).from(records).leftJoin(demons, eq(records.demonId, demons.id)).where(eq(records.userId, user.id) && eq(records.status, "approved"));
      const verifierResult = await db.select({
        verifierPoints: sql2`COALESCE(SUM(${demons.points}), 0)`,
        verifiedCount: sql2`COUNT(${demons.id})`
      }).from(demons).where(eq(demons.verifierId, user.id));
      const completionPoints = completionResult[0]?.points || 0;
      const completions = completionResult[0]?.completions || 0;
      const verifierPoints = verifierResult[0]?.verifierPoints || 0;
      const verifiedCount = verifierResult[0]?.verifiedCount || 0;
      const totalPoints = completionPoints + verifierPoints;
      return {
        userId: user.id,
        user: {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl
        },
        completionPoints,
        verifierPoints,
        points: totalPoints,
        completions,
        verifiedCount
      };
    }));
    const sorted = leaderboard.filter((entry) => entry.points > 0).sort((a, b) => b.points - a.points);
    return sorted.map((entry, index2) => ({
      ...entry,
      rank: index2 + 1
    }));
  }
};
var storage = new DatabaseStorage();

// server/sessionAuth.ts
import session from "express-session";
import connectPg from "connect-pg-simple";
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl
    }
  });
}
async function setupSessionAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
}
function isAuthenticated(req, res, next) {
  if (req.session?.user?.claims?.sub) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}
function isAdmin(req, res, next) {
  if (req.session?.user?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
}

// server/customAuth.ts
import * as bcrypt from "bcryptjs";
import { fromError } from "zod-validation-error";
import { z as z2 } from "zod";
var loginSchema = z2.object({
  username: z2.string().min(3, "Username must be at least 3 characters"),
  password: z2.string().min(6, "Password must be at least 6 characters")
});
var signupSchema = z2.object({
  username: z2.string().min(3, "Username must be at least 3 characters").max(30),
  password: z2.string().min(8, "Password must be at least 8 characters"),
  firstName: z2.string().optional(),
  lastName: z2.string().optional()
});
async function setupCustomAuth(app2) {
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        const error = fromError(validation.error);
        return res.status(400).json({ message: error.toString() });
      }
      const { username, password } = validation.data;
      const user = await storage.getUserByUsername(username);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.user = {
        claims: { sub: user.id },
        username: user.username
      };
      res.json({ message: "Logged in successfully" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });
  app2.post("/api/auth/signup", async (req, res) => {
    try {
      const validation = signupSchema.safeParse(req.body);
      if (!validation.success) {
        const error = fromError(validation.error);
        return res.status(400).json({ message: error.toString() });
      }
      const { username, password, firstName, lastName } = validation.data;
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already taken" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.upsertUser({
        username,
        passwordHash,
        firstName,
        lastName
      });
      req.session.user = {
        claims: { sub: user.id },
        username: user.username
      };
      res.json({ message: "Account created successfully" });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });
}

// server/routes.ts
import { fromError as fromError2 } from "zod-validation-error";
async function registerRoutes(app2) {
  await setupSessionAuth(app2);
  await setupCustomAuth(app2);
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.patch("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { username } = req.body;
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required" });
      }
      const user = await storage.updateUserProfile(userId, username.trim());
      res.json(user);
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "Username already taken" });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  app2.get("/api/demons", async (req, res) => {
    try {
      const listType = req.query.listType;
      const demons2 = await storage.getAllDemons(listType);
      res.json(demons2);
    } catch (error) {
      console.error("Error fetching demons:", error);
      res.status(500).json({ message: "Failed to fetch demons" });
    }
  });
  app2.get("/api/demons/:id", async (req, res) => {
    try {
      const demonId = req.params.id;
      const demon = await storage.getDemon(demonId);
      if (!demon) {
        return res.status(404).json({ message: "Demon not found" });
      }
      res.json(demon);
    } catch (error) {
      console.error("Error fetching demon:", error);
      res.status(500).json({ message: "Failed to fetch demon" });
    }
  });
  app2.get("/api/demons/:id/records", async (req, res) => {
    try {
      const demonId = req.params.id;
      const records2 = await storage.getApprovedRecordsByDemon(demonId);
      res.json(records2);
    } catch (error) {
      console.error("Error fetching records:", error);
      res.status(500).json({ message: "Failed to fetch records" });
    }
  });
  app2.get("/api/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
  app2.post("/api/records", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertRecordSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = fromError2(validation.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      const record = await storage.createRecord(userId, validation.data);
      res.json(record);
    } catch (error) {
      console.error("Error creating record:", error);
      res.status(500).json({ message: error.message || "Failed to create record" });
    }
  });
  app2.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      res.json(users2);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.get("/api/admin/records", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const records2 = await storage.getAllRecords();
      res.json(records2);
    } catch (error) {
      console.error("Error fetching records:", error);
      res.status(500).json({ message: "Failed to fetch records" });
    }
  });
  app2.post("/api/admin/records/:id/approve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const recordId = req.params.id;
      const reviewerId = req.user.claims.sub;
      await storage.approveRecord(recordId, reviewerId);
      res.json({ message: "Record approved" });
    } catch (error) {
      console.error("Error approving record:", error);
      res.status(500).json({ message: error.message || "Failed to approve record" });
    }
  });
  app2.post("/api/admin/records/:id/reject", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const recordId = req.params.id;
      const reviewerId = req.user.claims.sub;
      await storage.rejectRecord(recordId, reviewerId);
      res.json({ message: "Record rejected" });
    } catch (error) {
      console.error("Error rejecting record:", error);
      res.status(500).json({ message: error.message || "Failed to reject record" });
    }
  });
  app2.post("/api/admin/demons", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validation = insertDemonSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = fromError2(validation.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      const demon = await storage.createDemon(validation.data);
      res.json(demon);
    } catch (error) {
      console.error("Error creating demon:", error);
      res.status(500).json({ message: error.message || "Failed to create demon" });
    }
  });
  app2.put("/api/admin/demons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const demonId = req.params.id;
      const validation = insertDemonSchema.safeParse(req.body);
      if (!validation.success) {
        const validationError = fromError2(validation.error);
        return res.status(400).json({ message: validationError.toString() });
      }
      const demon = await storage.updateDemon(demonId, validation.data);
      res.json(demon);
    } catch (error) {
      console.error("Error updating demon:", error);
      res.status(500).json({ message: error.message || "Failed to update demon" });
    }
  });
  app2.delete("/api/admin/demons/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const demonId = req.params.id;
      await storage.deleteDemon(demonId);
      res.json({ message: "Demon deleted" });
    } catch (error) {
      console.error("Error deleting demon:", error);
      res.status(500).json({ message: error.message || "Failed to delete demon" });
    }
  });
  app2.post("/api/admin/demons/reorder", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { demons: demonOrder, listType } = req.body;
      if (!Array.isArray(demonOrder) || !listType) {
        return res.status(400).json({ message: "Invalid request data" });
      }
      await storage.reorderDemons(demonOrder, listType);
      res.json({ message: "Demons reordered and points recalculated" });
    } catch (error) {
      console.error("Error reordering demons:", error);
      res.status(500).json({ message: error.message || "Failed to reorder demons" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/app.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
var app = express();
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
async function runApp(setup) {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  await setup(app, server);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
}

// server/index-prod.ts
async function serveStatic(app2, _server) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
(async () => {
  await runApp(serveStatic);
})();
export {
  serveStatic
};
