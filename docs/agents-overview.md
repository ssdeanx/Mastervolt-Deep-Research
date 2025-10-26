# Agent Overview

## Creating an Agent

An agent requires three properties: a name, instructions, and a model.

```typescript
import { Agent } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Assistant",
  instructions: "Answer questions clearly and concisely.",
  model: openai("gpt-4o"),
});
```

The `instructions` property defines the agent's behavior. The `model` comes from [ai-sdk](https://sdk.vercel.ai/) and can be any supported provider (OpenAI, Anthropic, Google, etc.).

## Using Agents: Direct Method Calls

### Text Generation

Use these methods when you need text responses.

generateText - Returns the complete text response at once.

```typescript
const result = await agent.generateText("What is TypeScript?");
console.log(result.text);
```

streamText - Streams text chunks as they're generated (for real-time UIs).

```typescript
const stream = await agent.streamText("Explain async/await");
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

### Streaming Features

#### fullStream for Detailed Events

Use `fullStream` to receive detailed streaming events including tool calls, reasoning steps, and completion status.

```typescript
const response = await agent.streamText("Write a story");
for await (const chunk of response.fullStream) {
  switch (chunk.type) {
    case "text-delta":
      process.stdout.write(chunk.textDelta);
      break;
    case "tool-call":
      console.log(`\nUsing tool: ${chunk.toolName}`);
      break;
    case "tool-result":
      console.log(`Tool completed: ${chunk.toolName}`);
      break;
    case "finish":
      console.log(`\nDone! Tokens: ${chunk.usage?.totalTokens}`);
      break;
  }
}
```

#### Promise-based Properties

Access final values as Promises that resolve when streaming completes.

```typescript
const response = await agent.streamText("Explain async/await");
// Process stream
(async () => {
  for await (const chunk of response.textStream) {
    process.stdout.write(chunk);
  }
})();
// Access final values (resolve when stream completes)
const [fullText, usage, finishReason] = await Promise.all([
  response.text, // Promise<string>
  response.usage, // Promise<UsageInfo>
  response.finishReason, // Promise<string>
]);
console.log(`\nTotal: ${fullText.length} chars, ${usage?.totalTokens} tokens`);
```

### Structured Data Generation

There are two approaches for getting structured data from agents:

#### Option 1: generateObject / streamObject (Schema-Only)

These methods validate output against a schema but do not support tool calling. Use these for simple data extraction without tools.

generateObject - Returns a complete validated object.

```typescript
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number(),
  skills: z.array(z.string()),
});

const result = await agent.generateObject("Create a developer profile for Alex", schema);
console.log(result.object);
// { name: "Alex", age: 28, skills: [...] }
```

streamObject - Streams partial objects as they're built.

```typescript
const stream = await agent.streamObject("Create a profile for Jamie", schema);
for await (const partial of stream.partialObjectStream) {
  console.log(partial);
  // { name: "Jamie" } -> { name: "Jamie", age: 25 } -> ...
}
```

#### Option 2: experimental_output (Schema + Agent Features)

Use `experimental_output` with `generateText`/`streamText` to get structured data while still using tools, memory, and all agent capabilities.

```typescript
import { Output } from "ai";

const recipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
  prepTime: z.number(),
});

// With generateText - supports tool calling and memory
const result = await agent.generateText("Create a pasta recipe", {
  experimental_output: Output.object({ schema: recipeSchema }),
});
console.log(result.experimental_output); // { name: "...", ingredients: [...], ... }

// With streamText - stream partial objects while using tools
const stream = await agent.streamText("Create a detailed recipe", {
  experimental_output: Output.object({ schema: recipeSchema }),
});
for await (const partial of stream.experimental_partialOutputStream ?? []) {
  console.log(partial);
  // Incrementally built object
}

// Constrained text generation
const haiku = await agent.generateText("Write a haiku about coding", {
  experimental_output: Output.text({
    maxLength: 100,
    description: "A traditional haiku poem",
  }),
});
console.log(haiku.experimental_output);
```

When to use which:

• Use `generateObject`/`streamObject` for simple schema validation without tool calling
• Use `experimental_output` when you need structured output and tool calling

### Input Types

All methods accept either a string or an array of messages:

```typescript
// String input
await agent.generateText("Hello");

// Message array (for multimodal or conversation history)
await agent.generateText([{
  role: "user",
  content: "What's in this image?"
}]);
```

## Using Agents: REST API

VoltAgent can expose agents through HTTP endpoints. This lets you call agents from any client (web, mobile, etc.).

### Server Setup

Create a `VoltAgent` instance with a server provider:

```typescript
import { VoltAgent, Agent } from "@voltagent/core";
import { honoServer } from "@voltagent/server-hono";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "assistant",
  instructions: "Answer questions clearly.",
  model: openai("gpt-4o"),
});

new VoltAgent({
  agents: { assistant: agent },
  server: honoServer(),
  // Starts on port 3141 by default
});
```

### Available Endpoints

The server exposes the following REST endpoints:

#### Text Generation Endpoints

• `POST /agents/:id/text` - Generate complete text response (synchronous)
• `POST /agents/:id/stream` - Stream raw fullStream events (SSE)
• `POST /agents/:id/chat` - Stream UI messages for useChat hook (SSE)

#### Structured Data

• `POST /agents/:id/object` - Generate structured object (synchronous)
• `POST /agents/:id/stream-object` - Stream object generation (SSE)

Endpoint comparison:

| Endpoint | Method | Response | Description |
|----------|--------|----------|-------------|
| /text | POST | JSON | Complete text response at once |
| /stream | POST | SSE | Raw stream events (text-delta, tool-call, tool-result, finish) |
| /chat | POST | SSE | UI message stream for ai-sdk's useChat hook |
| /object | POST | JSON | Complete structured object at once |
| /stream-object | POST | SSE | Streaming partial objects |

### Calling from Next.js API Route

Example Next.js API route using the SDK (not direct REST calls):

```typescript
// app/api/chat/route.ts
import { agent } from "@/voltagent";

export async function POST(req: Request) {
  const { messages, conversationId, userId } = await req.json();
  const result = await agent.streamText(messages, {
    conversationId,
    userId,
  });
  return result.toUIMessageStreamResponse();
}
```

To call the REST API directly from a client:

```typescript
// Client-side code
const response = await fetch("http://localhost:3141/agents/assistant/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello" }],
  }),
});
// Stream response (SSE)
const reader = response.body.getReader();
// ... process stream chunks
```

## Constructor Options

You can configure agents with additional options:

```typescript
const agent = new Agent({
  // Required
  name: "MyAgent", // Agent identifier
  instructions: "You are a helpful assistant", // Behavior guidelines
  model: openai("gpt-4o"), // AI model to use (ai-sdk)

  // Optional
  id: "custom-id", // Unique ID (auto-generated if not provided)
  purpose: "Customer support agent", // Agent purpose for supervisor context
  tools: [weatherTool, searchTool], // Available tools
  memory: memoryStorage, // Memory instance (or false to disable)
  context: new Map([
    // Default context for all operations
    ["environment", "production"],
  ]),
  maxSteps: 10, // Maximum tool-use iterations
  temperature: 0.7, // Default creativity (overridable per call)
  maxOutputTokens: 512, // Default token limit (overridable per call)
  subAgents: [researchAgent], // Sub-agents for delegation
  supervisorConfig: {
    // Supervisor behavior config
    systemMessage: "Custom supervisor instructions",
    includeAgentsMemory: true,
  },
  // Additional constructor parameters
  hooks: createHooks({ onStart, onEnd }), // Lifecycle event handlers
  retriever: new PineconeRetriever(), // RAG retriever
  voice: new ElevenLabsVoice(), // Voice configuration
  markdown: true, // Enable markdown formatting
  voltOpsClient: new VoltOpsClient({
    // Observability & prompt management
    publicKey: "...",
    secretKey: "...",
  }),
  maxHistoryEntries: 1000, // Max history entries to store
});
```

## Advanced Features

Agents support additional capabilities through configuration options. Each feature is briefly explained below with a link to detailed documentation.

### Memory

Memory stores conversation history so agents can reference past messages. By default, agents use in-memory storage (non-persistent). You can configure persistent storage adapters.

```typescript
import { Memory } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";

const memory = new Memory({
  storage: new LibSQLMemoryAdapter({ url: "file:./.voltagent/memory.db" }),
});

const agent = new Agent({
  name: "Agent with Memory",
  model: openai("gpt-4o"),
  memory,
});
```

[Memory documentation](https://voltagent.dev/docs/agents/memory/overview/)

### Tools

Tools let agents call functions to fetch data, perform actions, or interact with external systems. The LLM decides when to use tools based on the user's input.

```typescript
import { createTool } from "@voltagent/core";
import { z } from "zod";

const weatherTool = createTool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    // Call weather API
    return { temperature: 72, conditions: "sunny" };
  },
});

const agent = new Agent({
  name: "Weather Assistant",
  instructions: "Answer weather questions using the get_weather tool.",
  model: openai("gpt-4o"),
  tools: [weatherTool],
});
```

[Tools documentation](https://voltagent.dev/docs/agents/tools/)

#### Using Agents as Tools

Agents can be converted to tools and used by other agents:

```typescript
const writerAgent = new Agent({
  id: "writer",
  purpose: "Writes blog posts",
  model: openai("gpt-4o-mini"),
});

const editorAgent = new Agent({
  id: "editor",
  purpose: "Edits content",
  model: openai("gpt-4o-mini"),
});

// Coordinator uses them as tools
const coordinator = new Agent({
  tools: [writerAgent.toTool(), editorAgent.toTool()],
  model: openai("gpt-4o-mini"),
});
```

This is useful when the LLM should decide which agents to call based on the request.

### Guardrails

Guardrails run before and after the model call to validate inputs or adjust outputs. Input guardrails receive the request text, while output guardrails can rewrite or block the response before it reaches the caller.

```typescript
import { Agent } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Guarded Assistant",
  instructions: "Answer briefly.",
  model: openai("gpt-4o-mini"),
  inputGuardrails: [
    {
      id: "reject-empty",
      name: "Reject Empty Prompts",
      handler: async ({ inputText }) => {
        if (inputText.trim().length === 0) {
          return {
            pass: false,
            action: "block",
            message: "Prompt cannot be empty.",
          };
        }
        return { pass: true };
      },
    },
  ],
  outputGuardrails: [
    {
      id: "trim-output",
      name: "Trim Whitespace",
      handler: async ({ output }) => ({
        pass: true,
        action: "modify",
        modifiedOutput: typeof output === "string" ? output.trim() : output,
      }),
    },
  ],
});

const response = await agent.generateText("  Give me one fact about Mars.  ");
console.log(response.text); // "Give me one fact about Mars." (trimmed)
```

[Learn more about Guardrails](https://voltagent.dev/docs/guardrails/built-in/)

### Sub-Agents

Sub-agents let you delegate tasks to specialized agents. The parent agent can call sub-agents through an automatically generated `delegate_task` tool.

```typescript
const researchAgent = new Agent({
  name: "Researcher",
  instructions: "Research topics thoroughly.",
  model: openai("gpt-4o"),
});

const writerAgent = new Agent({
  name: "Writer",
  instructions: "Write clear, concise content.",
  model: openai("gpt-4o"),
});

const coordinator = new Agent({
  name: "Coordinator",
  instructions: "Delegate research to Researcher and writing to Writer.",
  model: openai("gpt-4o"),
  subAgents: [researchAgent, writerAgent],
});
```

#### Event Filtering

When streaming with sub-agents, by default only `tool-call` and `tool-result` events are forwarded from sub-agents to reduce noise.

Enable all event types:

```typescript
const coordinator = new Agent({
  name: "Coordinator",
  instructions: "Coordinate between agents.",
  model: openai("gpt-4o"),
  subAgents: [researchAgent, writerAgent],
  supervisorConfig: {
    fullStreamEventForwarding: {
      types: ["tool-call", "tool-result", "text-delta", "reasoning", "source", "error", "finish"],
    },
  },
});

// Now receive all sub-agent events
const response = await coordinator.streamText("Research and write about AI");
for await (const chunk of response.fullStream) {
  if (chunk.subAgentId && chunk.subAgentName) {
    console.log(`[${chunk.subAgentName}] ${chunk.type}`);
  }
}
```

[Sub-Agents documentation](https://voltagent.dev/docs/agents/sub-agents/)

### Hooks

Hooks let you run code at specific points in the agent lifecycle: before/after operations, before/after tool calls, etc. Use hooks for logging, monitoring, or custom logic.

```typescript
import { createHooks } from "@voltagent/core";

const hooks = createHooks({
  onStart: async ({ agent, context }) => {
    console.log(`${agent.name} started`);
  },
  onEnd: async ({ agent, output, error }) => {
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Completed:", output);
    }
  },
});

const agent = new Agent({
  name: "Agent",
  instructions: "Answer questions.",
  model: openai("gpt-4o"),
  hooks,
});
```

[Hooks documentation](https://voltagent.dev/docs/agents/hooks/)

### Prompt Management

Instructions can be static strings, dynamic functions, or managed remotely via VoltOps. Dynamic instructions let you change agent behavior based on runtime context.

```typescript
// Static instructions
const agent1 = new Agent({
  name: "Assistant",
  instructions: "Answer questions.",
  model: openai("gpt-4o"),
});

// Dynamic instructions
const agent2 = new Agent({
  name: "Assistant",
  instructions: ({ context }) => {
    const tier = context.get("tier") || "free";
    return tier === "premium" ? "Provide detailed answers." : "Provide concise answers.";
  },
  model: openai("gpt-4o"),
});
```

[Prompt Management documentation](https://voltagent.dev/docs/agents/prompts/)

### Dynamic Agents

Agent properties (instructions, model, tools) can be functions that evaluate at runtime based on context. This enables multi-tenant apps, role-based access, or per-user model selection.

```typescript
const agent = new Agent({
  name: "Agent",
  instructions: ({ context }) => {
    const role = context.get("role");
    return role === "admin" ? "Admin instructions." : "User instructions.";
  },
  model: ({ context }) => {
    const tier = context.get("tier");
    return tier === "premium" ? openai("gpt-4o") : openai("gpt-4o-mini");
  },
});

await agent.generateText("Hello", {
  context: new Map([
    ["role", "admin"],
    ["tier", "premium"],
  ]),
});
```

[Dynamic Agents documentation](https://voltagent.dev/docs/agents/dynamic-agents/)

### Operation Context

Pass request-specific data (like request IDs, user info) between hooks and tools using the operation context `Map`. Context is scoped to a single operation.

```typescript
const hooks = createHooks({
  onStart: async ({ context }) => {
    context.context.set("requestId", `req-${Date.now()}`);
  },
});

const tool = createTool({
  name: "logger",
  parameters: z.object({ message: z.string() }),
  execute: async (params, oc) => {
    const requestId = oc?.context?.get("requestId");
    console.log(`[${requestId}] ${params.message}`);
  },
});
```

[Context documentation](https://voltagent.dev/docs/agents/context/)

### Retriever (RAG)

Retrievers fetch relevant context from external knowledge bases before calling the LLM. Implement the `BaseRetriever` interface to connect vector databases or document stores.

```typescript
class SimpleRetriever extends BaseRetriever {
  async retrieve(input: string | BaseMessage[]): Promise<string> {
    // Fetch relevant documents from vector DB or knowledge base
    return "Retrieved context goes here";
  }
}

const agent = new Agent({
  name: "Assistant",
  instructions: "Answer using retrieved context.",
  model: openai("gpt-4o"),
  retriever: new SimpleRetriever(),
});
```

[Retriever documentation](https://voltagent.dev/docs/rag/overview/)

### Models and Providers

VoltAgent uses [ai-sdk](https://sdk.vercel.ai/) models directly. Switch providers by changing the model import.

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

const agent1 = new Agent({
  name: "OpenAI Agent",
  model: openai("gpt-4o"),
  instructions: "Answer questions.",
});

const agent2 = new Agent({
  name: "Anthropic Agent",
  model: anthropic("claude-3-5-sonnet"),
  instructions: "Answer questions.",
});
```

[Providers and Models documentation](https://voltagent.dev/docs/getting-started/providers-models/)

### Call Settings

Configure generation behavior per-call with parameters like `temperature`, `maxOutputTokens`, `topP`, etc.

```typescript
await agent.generateText("Write a story", {
  temperature: 0.8,
  maxOutputTokens: 500,
  topP: 0.9,
  seed: 12345,
  // Provider-specific options
  providerOptions: {
    someProviderSpecificOption: {
      foo: "bar",
    },
  },
});
```

### Markdown Formatting

Enable automatic markdown formatting in text responses by setting `markdown: true`. The agent will use markdown syntax (headings, lists, bold text, etc.) in its responses.

```typescript
const agent = new Agent({
  name: "Assistant",
  instructions: "Answer questions clearly.",
  model: openai("gpt-4o"),
  markdown: true,
});

const result = await agent.generateText("Explain how to make tea.");
// Response will be formatted with markdown
```

### Step Control (maxSteps)

`maxSteps` limits how many LLM calls (steps) an agent can make in a single operation. Each tool call consumes a step. Default is 5.

```typescript
// Set maxSteps at agent level
const agent = new Agent({
  name: "Agent",
  model: openai("gpt-4o"),
  maxSteps: 5, // Default for all operations
});

// Or override per-call
await agent.generateText("Question", { maxSteps: 3 });
```

### Cancellation (AbortController)

Cancel long-running operations using `AbortController`. Pass the signal to agent methods.

```typescript
const abortController = new AbortController();
setTimeout(() => abortController.abort(), 5000); // Cancel after 5s

try {
  const response = await agent.generateText("Long task...", {
    abortSignal: abortController.signal,
  });
} catch (error) {
  if (isAbortError(error)) {
    console.log("Cancelled");
  }
}
```

[Cancellation documentation](https://voltagent.dev/docs/agents/cancellation/)

### MCP (Model Context Protocol)

Connect to external MCP servers to use their tools as if they were local tools.

```typescript
import { MCPConfiguration } from "@voltagent/core";

const mcpConfig = new MCPConfiguration({
  servers: {
    myServer: {
      type: "http",
      url: "https://mcp-server.example.com",
    },
  },
});

const mcpTools = await mcpConfig.getTools();
const agent = new Agent({
  name: "Agent",
  model: openai("gpt-4o"),
  tools: mcpTools,
});
```

[MCP documentation](https://voltagent.dev/docs/agents/mcp/)

### Voice

Add speech-to-text and text-to-speech capabilities using voice providers.

```typescript
import { OpenAIVoiceProvider } from "@voltagent/voice";

const voice = new OpenAIVoiceProvider({
  apiKey: process.env.OPENAI_API_KEY,
  ttsModel: "tts-1",
  voice: "alloy",
});

const agent = new Agent({
  name: "Voice Assistant",
  model: openai("gpt-4o"),
  voice,
});

const result = await agent.generateText("Tell a story");
const audioStream = await agent.voice.speak(result.text);
```

[Voice documentation](https://voltagent.dev/docs/agents/voice/)

## Error Handling

Wrap agent calls in try-catch blocks. Errors during streaming are recorded in history and can be observed via the `onError` callback.

## Next Steps

See the links above for detailed documentation on each feature. For working examples, visit the [examples repository](https://github.com/voltagent/voltagent/tree/main/examples).

## Additional Links

- [VoltAgent home](https://voltagent.dev/)
- [Discord](https://s.voltagent.dev/discord)
- [GitHub](https://github.com/voltagent/voltagent)
- [VoltAgent Docs](https://voltagent.dev/docs/)
- [VoltOps Docs](https://voltagent.dev/voltops-llm-observability-docs/)
- [←Migration guide: 0.1.x → 1.x](https://voltagent.dev/docs/getting-started/migration-guide/)
- [Agent Instructions→](https://voltagent.dev/docs/agents/prompts/)
