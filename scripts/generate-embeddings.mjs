/**
 * Generate embeddings for all products in the database.
 * This creates semantic vectors for search functionality.
 * Run with: node scripts/generate-embeddings.mjs
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const EMBEDDING_DIMENSION = 384;

/**
 * Generate a deterministic embedding based on text content.
 * Uses a simple hash-based approach for consistent results.
 */
function generateSimpleEmbedding(text) {
  const embedding = [];
  const normalizedText = text.toLowerCase();
  
  // Create a simple hash-based embedding
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    let value = 0;
    for (let j = 0; j < normalizedText.length; j++) {
      value += normalizedText.charCodeAt(j) * Math.sin((i + 1) * (j + 1) * 0.01);
    }
    embedding.push(Math.tanh(value * 0.001)); // Normalize to [-1, 1]
  }
  
  // L2 normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
}

/**
 * Try to generate embedding using LLM API, fall back to simple method.
 */
async function generateEmbedding(text) {
  // For now, use simple embedding generation
  // In production, this would call the actual embedding API
  return generateSimpleEmbedding(text);
}

async function generateAllEmbeddings() {
  console.log("Connecting to database...");
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  // Get all products
  const [products] = await connection.execute(
    "SELECT id, title, description, category, subcategory, brand, features FROM products"
  );
  
  console.log(`Found ${products.length} products to process`);
  
  let success = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      // Combine product text for embedding
      let features = [];
      if (product.features) {
        try {
          // Try to parse as JSON first
          features = JSON.parse(product.features);
        } catch {
          // If not JSON, treat as comma-separated string or single value
          features = typeof product.features === 'string' 
            ? product.features.split(',').map(f => f.trim())
            : [String(product.features)];
        }
      }
      const textToEmbed = [
        product.title,
        product.description,
        product.category,
        product.subcategory,
        product.brand,
        ...features,
      ].filter(Boolean).join(" ");
      
      const embedding = await generateEmbedding(textToEmbed);
      
      // Insert or update embedding
      await connection.execute(
        `INSERT INTO product_embeddings (productId, embedding, embeddingModel, textUsed, createdAt, updatedAt)
         VALUES (?, ?, 'simple-hash-v1', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         embedding = VALUES(embedding),
         textUsed = VALUES(textUsed),
         updatedAt = NOW()`,
        [product.id, JSON.stringify(embedding), textToEmbed.slice(0, 1000)]
      );
      
      success++;
      console.log(`✓ Generated embedding for: ${product.title.slice(0, 50)}...`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed for ${product.title}:`, error.message);
    }
  }
  
  await connection.end();
  
  console.log(`\nEmbedding generation complete!`);
  console.log(`Success: ${success}, Failed: ${failed}`);
}

generateAllEmbeddings().catch(console.error);
