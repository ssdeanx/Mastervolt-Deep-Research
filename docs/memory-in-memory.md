# In-Memory Storage

`InMemoryStorageAdapter` stores conversation history in application memory. Data is lost when the application restarts.

## Default Behavior

Agents use in-memory storage by default when no `memory` option is provided:

```typescript
import { Agent } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

// Uses InMemoryStorageAdapter automatically
const agent = new Agent({
  name: "Assistant",
  instructions: "Help users with questions.",
  model: openai("gpt-4o-mini"),
});
```

## Explicit Configuration

Configure storage limits explicitly:

```typescript
import { Agent, Memory, InMemoryStorageAdapter } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  storage: new InMemoryStorageAdapter(),
});

const agent = new Agent({
  name: "Assistant",
  model: openai("gpt-4o-mini"),
  memory,
});
```

## Features

### Conversation Storage

- Messages stored per `userId` and `conversationId`
- All `StorageAdapter` methods supported
- No automatic message pruning - all messages are preserved in memory

### Working Memory

Supports both conversation and user-scoped working memory:

```typescript
const memory = new Memory({
  storage: new InMemoryStorageAdapter(),
  workingMemory: {
    enabled: true,
    scope: "conversation", // or "user"
  },
});
```

See [Working Memory](https://voltagent.dev/docs/agents/memory/working-memory/) for configuration details.

### Semantic Search (Development)

Combine with `InMemoryVectorAdapter` for semantic search during development:

```typescript
import {
  Memory,
  AiSdkEmbeddingAdapter,
  InMemoryVectorAdapter,
  InMemoryStorageAdapter,
} from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const memory = new Memory({
  storage: new InMemoryStorageAdapter(),
  embedding: new AiSdkEmbeddingAdapter(openai.embedding("text-embedding-3-small")),
  vector: new InMemoryVectorAdapter(),
});
```

Both storage and vectors are lost on restart. For persistent vectors, use `LibSQLVectorAdapter`.

## Use Cases

### Development & Testing

Test agent logic without database setup:

```typescript
import { Agent, Memory, InMemoryStorageAdapter } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const testAgent = new Agent({
  name: "Test Assistant",
  model: openai("gpt-4o-mini"),
  memory: new Memory({
    storage: new InMemoryStorageAdapter(),
  }),
});

// Test conversations without persistence
await testAgent.generateText("Test message", {
  userId: "test-user",
  conversationId: "test-conversation",
});
```

### Stateless Deployments

Serverless functions or ephemeral containers where persistence isn't needed:

```typescript
// Cloud function handler
export async function handler(event) {
  const agent = new Agent({
    name: "Serverless Assistant",
    model: openai("gpt-4o-mini"),
    // Default in-memory storage
  });

  return await agent.generateText(event.message, {
    userId: event.userId,
    conversationId: event.sessionId,
  });
}
```

### Demos & Examples

Quick prototypes without infrastructure dependencies.

## Limitations

- No persistence - All data lost on restart
- Memory usage - Large message counts consume application memory
- Not for production - Use persistent adapters for production applications

## Learn More

- [Managed Memory](https://voltagent.dev/docs/agents/memory/managed-memory/) - Production-ready hosted memory with zero setup
- [LibSQL / SQLite](https://voltagent.dev/docs/agents/memory/libsql/) - Self-hosted SQLite or edge deployments
- [PostgreSQL](https://voltagent.dev/docs/agents/memory/postgres/) - Self-hosted Postgres adapter
- [Supabase](https://voltagent.dev/docs/agents/memory/supabase/) - Supabase integration
