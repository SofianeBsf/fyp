import { serial, pgEnum, pgTable, text, timestamp, varchar, decimal, jsonb, boolean, integer } from "drizzle-orm/pg-core";

const userRoleEnum = pgEnum("role", ["user", "admin"]);
const availabilityEnum = pgEnum("availability", ["in_stock", "low_stock", "out_of_stock"]);
const interactionTypeEnum = pgEnum("interactionType", ["view", "click", "search_click", "add_to_cart", "purchase"]);
const uploadStatusEnum = pgEnum("status", ["pending", "processing", "embedding", "completed", "failed"]);
const metricTypeEnum = pgEnum("metricType", ["ndcg@10", "recall@10", "precision@10", "mrr", "custom"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Product catalog table storing all product metadata.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  asin: varchar("asin", { length: 20 }).unique(), // Amazon Standard Identification Number
  title: text("title").notNull(),
  description: text("description"),
  category: varchar("category", { length: 255 }),
  subcategory: varchar("subcategory", { length: 255 }),
  imageUrl: text("imageUrl"),
  price: decimal("price", { precision: 10, scale: 2 }),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("GBP"),
  rating: decimal("rating", { precision: 3, scale: 2 }), // 0.00 to 5.00
  reviewCount: integer("reviewCount").default(0),
  availability: availabilityEnum("availability").default("in_stock"),
  stockQuantity: integer("stockQuantity").default(100),
  brand: varchar("brand", { length: 255 }),
  features: jsonb("features").$type<string[]>(), // Product features as JSON array
  isFeatured: boolean("isFeatured").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Product embeddings table storing vector representations.
 * Embeddings are stored as JSON arrays.
 */
export const productEmbeddings = pgTable("product_embeddings", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().unique(),
  embedding: jsonb("embedding").$type<number[]>().notNull(), // 384-dimensional vector for all-MiniLM-L6-v2
  embeddingModel: varchar("embeddingModel", { length: 100 }).default("all-MiniLM-L6-v2"),
  textUsed: text("textUsed"), // The text that was embedded (title + description + features)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ProductEmbedding = typeof productEmbeddings.$inferSelect;
export type InsertProductEmbedding = typeof productEmbeddings.$inferInsert;

/**
 * Anonymous session table for tracking user interactions without login.
 */
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(), // UUID for anonymous tracking
  userId: integer("userId"), // Optional: linked if user logs in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session interactions for session-based recommendations.
 */
export const sessionInteractions = pgTable("session_interactions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  productId: integer("productId").notNull(),
  interactionType: interactionTypeEnum("interactionType").notNull(),
  searchQuery: text("searchQuery"), // The query that led to this interaction
  position: integer("position"), // Position in search results when clicked
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SessionInteraction = typeof sessionInteractions.$inferSelect;
export type InsertSessionInteraction = typeof sessionInteractions.$inferInsert;

/**
 * Ranking weights configuration for the explainable AI formula.
 * Score = α*semantic + β*rating + γ*price_norm + δ*stock_norm + ε*recency
 */
export const rankingWeights = pgTable("ranking_weights", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().default("default"),
  alpha: decimal("alpha", { precision: 4, scale: 3 }).default("0.500").notNull(), // Semantic similarity weight
  beta: decimal("beta", { precision: 4, scale: 3 }).default("0.200").notNull(),  // Rating weight
  gamma: decimal("gamma", { precision: 4, scale: 3 }).default("0.150").notNull(), // Price weight (inverse)
  delta: decimal("delta", { precision: 4, scale: 3 }).default("0.100").notNull(), // Stock availability weight
  epsilon: decimal("epsilon", { precision: 4, scale: 3 }).default("0.050").notNull(), // Recency weight
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RankingWeight = typeof rankingWeights.$inferSelect;
export type InsertRankingWeight = typeof rankingWeights.$inferInsert;

/**
 * Search logs for evaluation and IR metrics.
 */
export const searchLogs = pgTable("search_logs", {
  id: serial("id").primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  query: text("query").notNull(),
  queryEmbedding: jsonb("queryEmbedding").$type<number[]>(), // Store query embedding for analysis
  resultsCount: integer("resultsCount").default(0),
  responseTimeMs: integer("responseTimeMs"), // For performance tracking
  filters: jsonb("filters").$type<Record<string, unknown>>(), // Applied filters
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchLog = typeof searchLogs.$inferSelect;
export type InsertSearchLog = typeof searchLogs.$inferInsert;

/**
 * Search result explanations for XAI transparency.
 */
export const searchResultExplanations = pgTable("search_result_explanations", {
  id: serial("id").primaryKey(),
  searchLogId: integer("searchLogId").notNull(),
  productId: integer("productId").notNull(),
  position: integer("position").notNull(), // Rank position in results
  finalScore: decimal("finalScore", { precision: 8, scale: 6 }).notNull(),
  semanticScore: decimal("semanticScore", { precision: 8, scale: 6 }).notNull(),
  ratingScore: decimal("ratingScore", { precision: 8, scale: 6 }).notNull(),
  priceScore: decimal("priceScore", { precision: 8, scale: 6 }).notNull(),
  stockScore: decimal("stockScore", { precision: 8, scale: 6 }).notNull(),
  recencyScore: decimal("recencyScore", { precision: 8, scale: 6 }).notNull(),
  matchedTerms: jsonb("matchedTerms").$type<string[]>(), // Terms that matched in the product
  explanation: text("explanation"), // Human-readable explanation
  wasClicked: boolean("wasClicked").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchResultExplanation = typeof searchResultExplanations.$inferSelect;
export type InsertSearchResultExplanation = typeof searchResultExplanations.$inferInsert;

/**
 * Catalog upload jobs for tracking CSV imports.
 */
export const catalogUploadJobs = pgTable("catalog_upload_jobs", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  status: uploadStatusEnum("status").default("pending").notNull(),
  totalRows: integer("totalRows").default(0),
  processedRows: integer("processedRows").default(0),
  embeddedRows: integer("embeddedRows").default(0),
  errorMessage: text("errorMessage"),
  uploadedBy: integer("uploadedBy"), // User ID of admin who uploaded
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CatalogUploadJob = typeof catalogUploadJobs.$inferSelect;
export type InsertCatalogUploadJob = typeof catalogUploadJobs.$inferInsert;

/**
 * Evaluation metrics for IR performance tracking.
 */
export const evaluationMetrics = pgTable("evaluation_metrics", {
  id: serial("id").primaryKey(),
  metricType: metricTypeEnum("metricType").notNull(),
  value: decimal("value", { precision: 8, scale: 6 }).notNull(),
  queryCount: integer("queryCount").default(0), // Number of queries in this evaluation
  notes: text("notes"),
  evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvaluationMetric = typeof evaluationMetrics.$inferSelect;
export type InsertEvaluationMetric = typeof evaluationMetrics.$inferInsert;
