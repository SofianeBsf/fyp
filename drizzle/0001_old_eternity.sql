CREATE TABLE `catalog_upload_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`status` enum('pending','processing','embedding','completed','failed') NOT NULL DEFAULT 'pending',
	`totalRows` int DEFAULT 0,
	`processedRows` int DEFAULT 0,
	`embeddedRows` int DEFAULT 0,
	`errorMessage` text,
	`uploadedBy` int,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `catalog_upload_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluation_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricType` enum('ndcg@10','recall@10','precision@10','mrr','custom') NOT NULL,
	`value` decimal(8,6) NOT NULL,
	`queryCount` int DEFAULT 0,
	`notes` text,
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluation_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_embeddings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`embedding` json NOT NULL,
	`embeddingModel` varchar(100) DEFAULT 'all-MiniLM-L6-v2',
	`textUsed` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_embeddings_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_embeddings_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`asin` varchar(20),
	`title` text NOT NULL,
	`description` text,
	`category` varchar(255),
	`subcategory` varchar(255),
	`imageUrl` text,
	`price` decimal(10,2),
	`originalPrice` decimal(10,2),
	`currency` varchar(10) DEFAULT 'GBP',
	`rating` decimal(3,2),
	`reviewCount` int DEFAULT 0,
	`availability` enum('in_stock','low_stock','out_of_stock') DEFAULT 'in_stock',
	`stockQuantity` int DEFAULT 100,
	`brand` varchar(255),
	`features` json,
	`isFeatured` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_asin_unique` UNIQUE(`asin`)
);
--> statement-breakpoint
CREATE TABLE `ranking_weights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL DEFAULT 'default',
	`alpha` decimal(4,3) NOT NULL DEFAULT '0.500',
	`beta` decimal(4,3) NOT NULL DEFAULT '0.200',
	`gamma` decimal(4,3) NOT NULL DEFAULT '0.150',
	`delta` decimal(4,3) NOT NULL DEFAULT '0.100',
	`epsilon` decimal(4,3) NOT NULL DEFAULT '0.050',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ranking_weights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`query` text NOT NULL,
	`queryEmbedding` json,
	`resultsCount` int DEFAULT 0,
	`responseTimeMs` int,
	`filters` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_result_explanations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`searchLogId` int NOT NULL,
	`productId` int NOT NULL,
	`position` int NOT NULL,
	`finalScore` decimal(8,6) NOT NULL,
	`semanticScore` decimal(8,6) NOT NULL,
	`ratingScore` decimal(8,6) NOT NULL,
	`priceScore` decimal(8,6) NOT NULL,
	`stockScore` decimal(8,6) NOT NULL,
	`recencyScore` decimal(8,6) NOT NULL,
	`matchedTerms` json,
	`explanation` text,
	`wasClicked` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `search_result_explanations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`productId` int NOT NULL,
	`interactionType` enum('view','click','search_click','add_to_cart','purchase') NOT NULL,
	`searchQuery` text,
	`position` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastActiveAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_sessionId_unique` UNIQUE(`sessionId`)
);
