
import mysql from "mysql2/promise";
import axios from "axios";

const DATABASE_URL = process.env.DATABASE_URL;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
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
          features = JSON.parse(product.features);
        } catch {
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
        ...(Array.isArray(features) ? features : []),
      ].filter(Boolean).join(" ");
      
      console.log(`Generating embedding for: ${product.title.slice(0, 50)}...`);
      
      const response = await axios.post(`${AI_SERVICE_URL}/embed`, { text: textToEmbed });
      const embedding = response.data.embedding;
      
      // Insert or update embedding
      await connection.execute(
        `INSERT INTO product_embeddings (productId, embedding, embeddingModel, textUsed, createdAt, updatedAt)
         VALUES (?, ?, 'all-MiniLM-L6-v2', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         embedding = VALUES(embedding),
         embeddingModel = VALUES(embeddingModel),
         textUsed = VALUES(textUsed),
         updatedAt = NOW()`,
        [product.id, JSON.stringify(embedding), textToEmbed.slice(0, 1000)]
      );
      
      success++;
      console.log(`✓ Saved embedding for: ${product.title.slice(0, 50)}...`);
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
