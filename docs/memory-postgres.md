# PostgreSQL Memory

`PostgreSQLMemoryAdapter` stores conversations in PostgreSQL for production applications with existing Postgres infrastructure.

## Installation

```bash
npm install @voltagent/postgres
```

## Configuration

```typescript
import { Agent, Memory } from "@voltagent/core";
import { PostgreSQLMemoryAdapter } from "@voltagent/postgres";
import { openai } from "@ai-sdk/openai";

// Using connection string
const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: process.env.DATABASE_URL!,
    // or: "postgresql://user:password@localhost:5432/mydb"
  }),
});

// Using connection object
const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      ssl: process.env.NODE_ENV === "production",
    },
  }),
});

const agent = new Agent({
  name: "Assistant",
  model: openai("gpt-4o-mini"),
  memory,
});
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| connection | string \| object | Connection string or object with host, port, database, user, password, ssl |
| maxConnections | number | Connection pool size (default: 10) |
| tablePrefix | string | Table name prefix (default: voltagent_memory) |
| debug | boolean | Enable debug logging (default: false) |

## Features

### Automatic Schema Creation

Tables are created automatically on first use:

- `${tablePrefix}_users`
- `${tablePrefix}_conversations`
- `${tablePrefix}_messages`
- `${tablePrefix}_workflow_states`

PostgreSQL version 12 or higher recommended.

### Conversation Storage

- Messages stored per `userId` and `conversationId`
- All `StorageAdapter` methods supported
- Supports complex queries with filtering, pagination, and sorting
- No automatic message pruning - all messages are preserved

### Working Memory

Supports both conversation and user-scoped working memory:

```typescript
const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: process.env.DATABASE_URL!,
  }),
  workingMemory: {
    enabled: true,
    scope: "user", // or "conversation"
    schema: z.object({
      preferences: z.array(z.string()).optional(),
    }),
  },
});
```

Storage:

- Conversation scope: `conversations.metadata.workingMemory`
- User scope: `${tablePrefix}_users.metadata.workingMemory`

See [Working Memory](https://voltagent.dev/docs/agents/memory/working-memory/) for configuration details.

### PostgreSQL Vector Storage

Store vector embeddings directly in PostgreSQL for semantic search (no extensions required):

```typescript
import { Memory, AiSdkEmbeddingAdapter } from "@voltagent/core";
import { PostgreSQLMemoryAdapter, PostgresVectorAdapter } from "@voltagent/postgres";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: process.env.DATABASE_URL!,
  }),
  embedding: new AiSdkEmbeddingAdapter(openai.embedding("text-embedding-3-small")),
  vector: new PostgresVectorAdapter({
    connection: process.env.DATABASE_URL!,
  }),
});
```

How It Works:

- BYTEA Storage: Vectors are stored as binary data using PostgreSQL's native `BYTEA` type
- In-Memory Similarity: Cosine similarity is computed in-memory after loading vectors
- No Extensions: Works with vanilla PostgreSQL 12+ without any extensions
- Automatic Setup: Creates tables and indexes automatically on first use

Configuration Options:

```typescript
const vectorAdapter = new PostgresVectorAdapter({
  connection: process.env.DATABASE_URL!,
  // Optional: customize table name (default: "voltagent_vector")
  tablePrefix: "custom_vector",
  // Optional: LRU cache size for frequently accessed vectors (default: 100)
  cacheSize: 100,
  // Optional: max vector dimensions (default: 1536)
  maxVectorDimensions: 1536,
});
```

Benefits:

- Unified Storage: Keep messages and vectors in the same database
- No Extensions: Works with any PostgreSQL instance (managed or self-hosted)
- Simple Setup: No extension installation or special configuration needed
- Standard Tools: Use familiar PostgreSQL monitoring and backup tools

Performance Considerations:

This adapter loads all vectors into memory for similarity computation, which works well for:

- Small to medium datasets (< 10,000 vectors)
- Development and prototyping
- Environments where extension installation is restricted

For large-scale production with millions of vectors, consider specialized vector databases or use `InMemoryVectorAdapter` with periodic persistence.

See [Semantic Search](https://voltagent.dev/docs/agents/memory/semantic-search/) for detailed configuration and usage.

## Production Setup

```typescript
import { Agent, Memory } from "@voltagent/core";
import { PostgreSQLMemoryAdapter } from "@voltagent/postgres";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      ssl: true, // Enable SSL for production
    },
    maxConnections: 20, // Adjust based on load
  }),
});

const agent = new Agent({
  name: "Production Assistant",
  model: openai("gpt-4o-mini"),
  memory,
});
```

### Advanced SSL Configuration

For databases requiring custom CA certificates or client certificates:

```typescript
import fs from "fs";

const memory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync("/path/to/ca-certificate.crt").toString(),
        // Optional: client certificate authentication
        key: fs.readFileSync("/path/to/client-key.key").toString(),
        cert: fs.readFileSync("/path/to/client-cert.crt").toString(),
      },
    },
    maxConnections: 20,
  }),
});
```

The `ssl` option accepts either:

- `boolean` - Simple SSL enable/disable
- `ConnectionOptions` - Full TLS configuration object with support for:
  - `ca` - Custom Certificate Authority
  - `key` - Client private key
  - `cert` - Client certificate
  - `rejectUnauthorized` - Certificate validation control
  - All other Node.js [TLS options](https://nodejs.org/api/tls.html#tls_tls_connect_options_callback)

### Security

- Use SSL connections in production (`ssl: true` or advanced config)
- Store credentials and certificates in environment variables or secure secret management
- Implement regular database backups
- Adjust `maxConnections` based on concurrent usage

Use cases:

- Applications with existing Postgres infrastructure
- High-availability requirements (replication, failover)
- Complex SQL queries or analytics on conversation data

For production-ready zero-setup hosting, see [Managed Memory](https://voltagent.dev/docs/agents/memory/managed-memory/).

## Learn More

- [Managed Memory](https://voltagent.dev/docs/agents/memory/managed-memory/) - Production-ready hosted memory with zero setup
- [Working Memory](https://voltagent.dev/docs/agents/memory/working-memory/) - Maintain compact context
- [Semantic Search](https://voltagent.dev/docs/agents/memory/semantic-search/) - Vector search configuration

## Additional Links

- [VoltAgent home](https://voltagent.dev/)
- [Discord](https://s.voltagent.dev/discord)
- [GitHub](https://github.com/voltagent/voltagent)
- [VoltAgent Docs](https://voltagent.dev/docs/)
- [VoltOps Docs](https://voltagent.dev/voltops-llm-observability-docs/)
- [←LibSQL / SQLite Memory](https://voltagent.dev/docs/agents/memory/libsql/)
- [Supabase Memory→](https://voltagent.dev/docs/agents/memory/supabase/)
