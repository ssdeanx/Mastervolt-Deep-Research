# Build Your Own Retriever

Want to connect your AI agent to your own database, API, or files? Here's how to build a custom retriever in 5 minutes.

## The Pattern (Copy & Paste)

Every retriever follows the same simple pattern:

```typescript
import { BaseRetriever } from "@voltagent/core";

class MyRetriever extends BaseRetriever {
  async retrieve(input, options) {
    // 1. Get the user's question
    const question = typeof input === "string" ? input : input[input.length - 1].content;
    
    // 2. Search your data source
    const results = await this.searchMyData(question);
    
    // 3. Return formatted results
    return results.join("\n\n");
  }
  
  async searchMyData(query) {
    // Replace this with your actual search logic
    return ["Sample result 1", "Sample result 2"];
  }
}
```

## Real Examples

### Search Local Files

```typescript
import { BaseRetriever } from "@voltagent/core";
import fs from "fs";
import path from "path";

class FileRetriever extends BaseRetriever {
  constructor(docsPath = "./docs") {
    super({
      toolName: "search_files",
      toolDescription: "Search through local documentation files",
    });
    this.docsPath = docsPath;
  }
  
  async retrieve(input, options) {
    const query = typeof input === "string" ? input : input[input.length - 1].content;
    
    // Read all .md files
    const files = fs.readdirSync(this.docsPath).filter((file) => file.endsWith(".md"));
    const results = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.docsPath, file), "utf8");
      if (content.toLowerCase().includes(query.toLowerCase())) {
        results.push(`File: ${file}\n${content.slice(0, 500)}...`);
      }
    }
    
    return results.length > 0 ? results.join("\n\n---\n\n") : "No relevant files found.";
  }
}
```

### Search PostgreSQL Database

```typescript
import { BaseRetriever } from "@voltagent/core";
import { Pool } from "pg";

class PostgreSQLRetriever extends BaseRetriever {
  constructor(connectionString) {
    super({
      toolName: "search_database",
      toolDescription: "Search the company knowledge database",
    });
    this.pool = new Pool({ connectionString });
  }
  
  async retrieve(input, options) {
    const query = typeof input === "string" ? input : input[input.length - 1].content;
    
    // Search using PostgreSQL full-text search
    const result = await this.pool.query(`
      SELECT title, content, ts_rank(search_vector, plainto_tsquery($1)) as rank
      FROM documents
      WHERE search_vector @@ plainto_tsquery($1)
      ORDER BY rank DESC
      LIMIT 5
    `, [query]);
    
    return result.rows.map((row) => `${row.title}: ${row.content}`).join("\n\n---\n\n");
  }
}
```

### Call External API

```typescript
import { BaseRetriever } from "@voltagent/core";

class APIRetriever extends BaseRetriever {
  constructor(apiKey) {
    super({
      toolName: "search_api",
      toolDescription: "Search external knowledge API",
    });
    this.apiKey = apiKey;
  }
  
  async retrieve(input, options) {
    const query = typeof input === "string" ? input : input[input.length - 1].content;
    
    const response = await fetch("https://api.example.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    
    const data = await response.json();
    
    return data.results.map((item) => `${item.title}: ${item.summary}`).join("\n\n---\n\n");
  }
}
```

## Track Sources (Optional)

Want to show users where the information came from? Use `context` to track sources:

```typescript
class SourceTrackingRetriever extends BaseRetriever {
  async retrieve(input, options) {
    const query = typeof input === "string" ? input : input[input.length - 1].content;
    
    // Your search logic here
    const results = await this.searchData(query);
    
    // Save sources for later reference
    if (options.context && results.length > 0) {
      const sources = results.map((r) => ({
        title: r.title,
        url: r.url,
        score: r.score,
      }));
      options.context.set("sources", sources);
    }
    
    return results.map((r) => r.content).join("\n\n");
  }
}

// Use it
const response = await agent.generateText("How do I deploy?");
console.log("Answer:", response.text);

// Check what sources were used
const sources = response.context?.get("sources");
sources?.forEach((s) => console.log(`Source: ${s.title} (${s.url})`));
```

Why track sources?

- Show users where info came from
- Debug what the retriever found
- Compliance and audit trails
- Better user experience

## How to Use Your Retriever

You can use your retriever in two ways:

### Option 1: Always Search

```typescript
const agent = new Agent({
  name: "Support Bot",
  retriever: new MyRetriever(),
  // Searches before every response
  // ... other config
});
```

When to use: Support bots, Q&A systems where you always want context

### Option 2: Search When Needed

```typescript
const retriever = new MyRetriever({
  toolName: "search_docs",
  toolDescription: "Search company documentation",
});

const agent = new Agent({
  name: "Smart Assistant",
  tools: [retriever.tool],
  // LLM decides when to search
  // ... other config
});
```

When to use: General assistants where you want the LLM to decide when to search

## Quick Decision Guide

| Scenario | Method | When to Use |
|----------|--------|-------------|
| Support bot | agent.retriever | Always needs context |
| Q&A system | agent.retriever | Every question needs search |
| General assistant | agent.tools | Let LLM decide when to search |
| Multi-tool agent | agent.tools | Mix with other tools |

## Pro Tips

Format your results clearly:

```typescript
// ❌ Hard to parse
return results.join(" ");

// ✅ Easy to parse
return results.map((r) => `Source: ${r.title}\n${r.content}`).join("\n\n---\n\n");
```

Handle errors gracefully:

```typescript
async retrieve(input, options) {
  try {
    const results = await this.searchData(input);
    return results.length > 0 ? results.join('\n\n') : "No results found.";
  } catch (error) {
    console.error('Search failed:', error);
    return "Search temporarily unavailable.";
  }
}
```

Make it fast:

```typescript
// Add timeouts and limits
const results = await Promise.race([
  this.searchData(query),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
]);
```

Good tool descriptions:

```typescript
// ❌ Vague
toolDescription: "Searches stuff";

// ✅ Specific
toolDescription: "Search company documentation, policies, and FAQ. Use when user asks about company procedures, benefits, or policies.";
```

## Learn More

- [RAG Overview →](https://voltagent.dev/docs/rag/overview/) - Complete guide to Retrieval-Augmented Generation
- [Chroma Integration →](https://voltagent.dev/docs/rag/chroma/) - Working example with Chroma vector database
- [Examples →](https://github.com/voltagent/voltagent/tree/main/examples) - See retriever implementations in action

## Additional Links

- [VoltAgent home](https://voltagent.dev/)
- [Discord](https://s.voltagent.dev/discord)
- [GitHub](https://github.com/voltagent/voltagent)
- [VoltAgent Docs](https://voltagent.dev/docs/)
- [VoltOps Docs](https://voltagent.dev/voltops-llm-observability-docs/)
- [←Overview](https://voltagent.dev/docs/rag/overview/)
- [Chroma Integration→](https://voltagent.dev/docs/rag/chroma/)
