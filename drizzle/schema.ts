import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Product catalog table storing all product metadata.
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
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
  reviewCount: int("reviewCount").default(0),
  availability: mysqlEnum("availability", ["in_stock", "low_stock", "out_of_stock"]).default("in_stock"),
  stockQuantity: int("stockQuantity").default(100),
  brand: varchar("brand", { length: 255 }),
  features: json("features").$type<string[]>(), // Product features as JSON array
  isFeatured: boolean("isFeatured").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Product embeddings table storing vector representations.
 * Embeddings are stored as JSON arrays (MySQL doesn't have native vector type).
 * We'll compute similarity in application layer using cosine similarity.
 */
export const productEmbeddings = mysqlTable("product_embeddings", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().unique(),
  embedding: json("embedding").$type<number[]>().notNull(), // 384-dimensional vector for all-MiniLM-L6-v2
  embeddingModel: varchar("embeddingModel", { length: 100 }).default("all-MiniLM-L6-v2"),
  textUsed: text("textUsed"), // The text that was embedded (title + description + features)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductEmbedding = typeof productEmbeddings.$inferSelect;
export type InsertProductEmbedding = typeof productEmbeddings.$inferInsert;

/**
 * Anonymous session table for tracking user interactions without login.
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(), // UUID for anonymous tracking
  userId: int("userId"), // Optional: linked if user logs in
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Session interactions for session-based recommendations.
 */
export const sessionInteractions = mysqlTable("session_interactions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  productId: int("productId").notNull(),
  interactionType: mysqlEnum("interactionType", ["view", "click", "search_click", "add_to_cart", "purchase"]).notNull(),
  searchQuery: text("searchQuery"), // The query that led to this interaction
  position: int("position"), // Position in search results when clicked
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SessionInteraction = typeof sessionInteractions.$inferSelect;
export type InsertSessionInteraction = typeof sessionInteractions.$inferInsert;

/**
 * Ranking weights configuration for the explainable AI formula.
 * Score = α*semantic + β*rating + γ*price_norm + δ*stock_norm + ε*recency
 */
export const rankingWeights = mysqlTable("ranking_weights", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().default("default"),
  alpha: decimal("alpha", { precision: 4, scale: 3 }).default("0.500").notNull(), // Semantic similarity weight
  beta: decimal("beta", { precision: 4, scale: 3 }).default("0.200").notNull(),  // Rating weight
  gamma: decimal("gamma", { precision: 4, scale: 3 }).default("0.150").notNull(), // Price weight (inverse)
  delta: decimal("delta", { precision: 4, scale: 3 }).default("0.100").notNull(), // Stock availability weight
  epsilon: decimal("epsilon", { precision: 4, scale: 3 }).default("0.050").notNull(), // Recency weight
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RankingWeight = typeof rankingWeights.$inferSelect;
export type InsertRankingWeight = typeof rankingWeights.$inferInsert;

/**
 * Search logs for evaluation and IR metrics.
 */
export const searchLogs = mysqlTable("search_logs", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  query: text("query").notNull(),
  queryEmbedding: json("queryEmbedding").$type<number[]>(), // Store query embedding for analysis
  resultsCount: int("resultsCount").default(0),
  responseTimeMs: int("responseTimeMs"), // For performance tracking
  filters: json("filters").$type<Record<string, unknown>>(), // Applied filters
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchLog = typeof searchLogs.$inferSelect;
export type InsertSearchLog = typeof searchLogs.$inferInsert;

/**
 * Search result explanations for XAI transparency.
 */
export const searchResultExplanations = mysqlTable("search_result_explanations", {
  id: int("id").autoincrement().primaryKey(),
  searchLogId: int("searchLogId").notNull(),
  productId: int("productId").notNull(),
  position: int("position").notNull(), // Rank position in results
  finalScore: decimal("finalScore", { precision: 8, scale: 6 }).notNull(),
  semanticScore: decimal("semanticScore", { precision: 8, scale: 6 }).notNull(),
  ratingScore: decimal("ratingScore", { precision: 8, scale: 6 }).notNull(),
  priceScore: decimal("priceScore", { precision: 8, scale: 6 }).notNull(),
  stockScore: decimal("stockScore", { precision: 8, scale: 6 }).notNull(),
  recencyScore: decimal("recencyScore", { precision: 8, scale: 6 }).notNull(),
  matchedTerms: json("matchedTerms").$type<string[]>(), // Terms that matched in the product
  explanation: text("explanation"), // Human-readable explanation
  wasClicked: boolean("wasClicked").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchResultExplanation = typeof searchResultExplanations.$inferSelect;
export type InsertSearchResultExplanation = typeof searchResultExplanations.$inferInsert;

/**
 * Catalog upload jobs for tracking CSV imports.
 */
export const catalogUploadJobs = mysqlTable("catalog_upload_jobs", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "embedding", "completed", "failed"]).default("pending").notNull(),
  totalRows: int("totalRows").default(0),
  processedRows: int("processedRows").default(0),
  embeddedRows: int("embeddedRows").default(0),
  errorMessage: text("errorMessage"),
  uploadedBy: int("uploadedBy"), // User ID of admin who uploaded
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CatalogUploadJob = typeof catalogUploadJobs.$inferSelect;
export type InsertCatalogUploadJob = typeof catalogUploadJobs.$inferInsert;

/**
 * Evaluation metrics for IR performance tracking.
 */
export const evaluationMetrics = mysqlTable("evaluation_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricType: mysqlEnum("metricType", ["ndcg@10", "recall@10", "precision@10", "mrr", "custom"]).notNull(),
  value: decimal("value", { precision: 8, scale: 6 }).notNull(),
  queryCount: int("queryCount").default(0), // Number of queries in this evaluation
  notes: text("notes"),
  evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvaluationMetric = typeof evaluationMetrics.$inferSelect;
export type InsertEvaluationMetric = typeof evaluationMetrics.$inferInsert;
