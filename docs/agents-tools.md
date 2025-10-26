# Tools

Tools enable agents to interact with external systems, APIs, databases, and perform specific actions beyond generating text. An agent uses its model to decide when to call tools based on their descriptions and the current context.

## Creating a Tool

Use `createTool` to define a tool with type-safe parameters and execution logic.

```typescript
import { createTool } from "@voltagent/core";
import { z } from "zod";

const weatherTool = createTool({
  name: "get_weather",
  description: "Get current weather for a location",
  parameters: z.object({
    location: z.string().describe("The city name"),
  }),
  execute: async ({ location }) => {
    // Call weather API
    const response = await fetch(`https://api.weather.com/current?city=${location}`);
    const data = await response.json();
    return {
      location,
      temperature: data.temp,
      conditions: data.conditions,
    };
  },
});
```

Each tool has:

- **name**: Unique identifier
- **description**: Explains what the tool does (the model uses this to decide when to call it)
- **parameters**: Input schema defined with Zod
- **execute**: Function that runs when the tool is called

The `execute` function's parameter types are automatically inferred from the Zod schema, providing full IntelliSense support.

## Using Tools with Agents

Add tools when creating an agent. The model decides when to use them based on the user's input and tool descriptions.

```typescript
import { Agent } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Weather Assistant",
  instructions: "An assistant that provides weather information",
  model: openai("gpt-4o"),
  tools: [weatherTool],
});

// The model calls the tool when appropriate
const response = await agent.generateText("What's the weather in Paris?");
console.log(response.text); // "The current weather in Paris is 22°C and sunny."
```

### Using Multiple Tools

Agents can use multiple tools together to answer complex queries.

```typescript
const calculatorTool = createTool({
  name: "calculate",
  description: "Perform mathematical calculations",
  parameters: z.object({
    expression: z.string().describe("The mathematical expression to evaluate"),
  }),
  execute: async ({ expression }) => {
    // Use a safe math parser in production
    const result = eval(expression);
    return { result };
  },
});

const agent = new Agent({
  name: "Multi-Tool Assistant",
  instructions: "An assistant that can check weather and perform calculations",
  model: openai("gpt-4o"),
  tools: [weatherTool, calculatorTool],
});

const response = await agent.generateText("What's the weather in Paris? Also, what is 24 * 7?");
// The model uses both tools and combines the results
```

### Dynamic Tool Registration

Add tools to an agent after creation or provide them per request.

```typescript
// Add tools after agent creation
agent.addTools([calculatorTool]);

// Provide tools for a specific request only
const response = await agent.generateText("Calculate 123 * 456", {
  tools: [calculatorTool],
});
```

## OperationContext

The `execute` function receives an `OperationContext` as its second parameter, providing access to operation metadata and control mechanisms.

```typescript
const debugTool = createTool({
  name: "log_debug_info",
  description: "Logs debugging information",
  parameters: z.object({
    message: z.string().describe("Debug message to log"),
  }),
  execute: async (args, context) => {
    // Access operation metadata
    console.log("Operation ID:", context?.operationId);
    console.log("User ID:", context?.userId);
    console.log("Conversation ID:", context?.conversationId);

    // Access the original input
    console.log("Original input:", context?.input);

    // Access custom context values
    const customValue = context?.context.get("customKey");

    // Check if operation is still active
    if (!context?.isActive) {
      throw new Error("Operation has been cancelled");
    }

    return `Logged: ${args.message}`;
  },
});
```

The `OperationContext` contains:

- `operationId`: Unique identifier for this operation
- `userId`: Optional user identifier
- `conversationId`: Optional conversation identifier
- `context`: Map for user-provided context values
- `systemContext`: Map for internal system values
- `isActive`: Whether the operation is still active
- `input`: The original input (string, UIMessage[], or BaseMessage[])
- `abortController`: AbortController for cancelling the operation
- `logger`: Execution-scoped logger with full context
- `traceContext`: OpenTelemetry trace context
- `elicitation`: Optional function for requesting user input

## Cancellation with AbortController

Tools can respond to cancellation signals and cancel the entire operation when needed.

```typescript
const searchTool = createTool({
  name: "search_web",
  description: "Search the web for information",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
  execute: async (args, context) => {
    const abortController = context?.abortController;
    const signal = abortController?.signal;

    // Check if already aborted
    if (signal?.aborted) {
      throw new Error("Search was cancelled before it started");
    }

    // Tool can trigger abort to cancel the entire operation
    if (args.query.includes("forbidden")) {
      abortController?.abort("Forbidden query detected");
      throw new Error("Search query contains forbidden terms");
    }

    try {
      // Pass signal to fetch for cancellation support
      const response = await fetch(`https://api.search.com?q=${args.query}`, { signal });

      // Abort based on response
      if (!response.ok && response.status === 429) {
        abortController?.abort("Rate limit exceeded");
        throw new Error("API rate limit exceeded");
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("Search was cancelled during execution");
      }
      throw error;
    }
  },
});
```

When calling an agent with an abort signal:

```typescript
import { isAbortError } from "@voltagent/core";

const abortController = new AbortController();
// Set timeout to abort after 30 seconds
setTimeout(() => abortController.abort("Operation timeout"), 30000);

try {
  const response = await agent.generateText("Search for the latest AI developments", {
    abortSignal: abortController.signal,
  });
  console.log(response.text);
} catch (error) {
  if (isAbortError(error)) {
    console.log("Operation was cancelled:", error.message);
  } else {
    console.error("Error:", error);
  }
}
```

## Client-Side Tools

Client-side tools execute in the browser or client application instead of on the server. They're useful for accessing browser APIs, user permissions, or client-specific features.

For a complete working setup, see the example: [with-client-side-tools](https://github.com/VoltAgent/voltagent/tree/main/examples/with-client-side-tools).

### What Makes a Tool Client-Side?

A tool without an `execute` function is automatically client-side.

```typescript
// Client-side tool (no execute function)
const getLocationTool = createTool({
  name: "getLocation",
  description: "Get the user's current location",
  parameters: z.object({}),
  // No execute = client-side
});

// Another client-side tool
const readClipboardTool = createTool({
  name: "readClipboard",
  description: "Read content from the user's clipboard",
  parameters: z.object({}),
});

// Server-side tool (has execute)
const getWeatherTool = createTool({
  name: "getWeather",
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string().describe("City name"),
  }),
  execute: async ({ city }) => {
    const response = await fetch(`https://api.weather.com/current?city=${city}`);
    return await response.json();
  },
});
```

### Handling Client-Side Tools

Use the `onToolCall` callback with `useChat` to handle client-side tool execution.

```typescript
import { useChat } from "@ai-sdk/react";
import type { ClientSideToolResult } from "@voltagent/core";
import { useState, useEffect, useCallback } from "react";

function Chat() {
  const [result, setResult] = useState<ClientSideToolResult | null>(null);

  const handleToolCall = useCallback(async ({ toolCall }) => {
    // Handle automatic execution for getLocation
    if (toolCall.toolName === "getLocation") {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setResult({
            tool: "getLocation",
            toolCallId: toolCall.toolCallId,
            output: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            },
          });
        },
        (error) => {
          setResult({
            state: "output-error",
            tool: "getLocation",
            toolCallId: toolCall.toolCallId,
            errorText: error.message,
          });
        }
      );
    }
  }, []);

  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onToolCall: handleToolCall,
  });

  // Send results back to the model
  useEffect(() => {
    if (!result) return;
    addToolResult(result);
  }, [result, addToolResult]);

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id}>{/* Render message */}</div>
      ))}
    </div>
  );
}
```

### Interactive Client-Side Tools

For tools requiring user interaction, render UI components:

```typescript
function ReadClipboardTool({ callId, state, addToolResult }: {
  callId: string;
  state?: string;
  addToolResult: (res: ClientSideToolResult) => void;
}) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div>
        <p>Allow access to your clipboard?</p>
        <button
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              addToolResult({
                tool: "readClipboard",
                toolCallId: callId,
                output: { content: text },
              });
            } catch {
              addToolResult({
                state: "output-error",
                tool: "readClipboard",
                toolCallId: callId,
                errorText: "Clipboard access denied",
              });
            }
          }}
        >
          Yes
        </button>
        <button
          onClick={() =>
            addToolResult({
              state: "output-error",
              tool: "readClipboard",
              toolCallId: callId,
              errorText: "Access denied",
            })
          }
        >
          No
        </button>
      </div>
    );
  }
  return <div>readClipboard: {state}</div>;
}
```

Important: You must call `addToolResult` to send the tool result back to the model. Without this, the model considers the tool call a failure.

## Tool Hooks

Hooks let you respond to tool execution events for logging, UI updates, or additional actions.

```typescript
import { Agent, createHooks, isAbortError } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

const hooks = createHooks({
  onToolStart({ agent, tool, context, args }) {
    console.log(`Tool starting: ${tool.name}`);
    console.log(`Agent: ${agent.name}`);
    console.log(`Operation ID: ${context.operationId}`);
    console.log("Arguments:", args);
  },

  onToolEnd({ agent, tool, output, error, context }) {
    console.log(`Tool completed: ${tool.name}`);
    if (error) {
      if (isAbortError(error)) {
        console.log(`Tool was aborted: ${error.message}`);
      } else {
        console.error(`Tool failed: ${error.message}`);
      }
    } else {
      console.log("Result:", output);
    }
  },
});

const agent = new Agent({
  name: "Assistant with Tool Hooks",
  instructions: "An assistant that logs tool execution",
  model: openai("gpt-4o"),
  tools: [weatherTool],
  hooks: hooks,
});
```

### Policy Enforcement with ToolDeniedError

Throw `ToolDeniedError` from a hook to block a tool and immediately stop the entire agent operation.

```typescript
import { createHooks, ToolDeniedError } from "@voltagent/core";

const hooks = createHooks({
  onToolStart({ tool, context }) {
    const plan = context.context.get("userPlan");

    // Block expensive tools for non-pro users
    if (tool.name === "search_web" && plan !== "pro") {
      throw new ToolDeniedError({
        toolName: tool.name,
        message: "Pro plan required to use web search.",
        code: "TOOL_PLAN_REQUIRED",
        httpStatus: 402,
      });
    }
  },
});
```

Catching the denial:

```typescript
import { isToolDeniedError } from "@voltagent/core";

try {
  const res = await agent.generateText("Please search the web", { hooks });
} catch (err) {
  if (isToolDeniedError(err)) {
    console.log("Tool denied:", {
      tool: err.name,
      status: err.httpStatus,
      code: err.code,
      message: err.message,
    });
    // Show upgrade UI, redirect, etc.
  } else {
    console.error("Operation failed:", err);
  }
}
```

Allowed `code` values:

- `TOOL_ERROR`
- `TOOL_FORBIDDEN`
- `TOOL_PLAN_REQUIRED`
- `TOOL_QUOTA_EXCEEDED`
- Custom codes (e.g., `"TOOL_REGION_BLOCKED"`)

## Best Practices

### Clear Descriptions

Provide clear descriptions for tools and parameters. The model relies on these to understand when and how to use tools.

Bad:

```typescript
const badTool = createTool({
  name: "search",
  description: "Searches things", // Too vague
  parameters: z.object({
    q: z.string(), // No description
  }),
  execute: async (args) => {
    /* ... */
  },
});
```

Good:

```typescript
const goodTool = createTool({
  name: "search_web",
  description: "Searches the web for current information. Use when you need recent or factual information not in your training data.",
  parameters: z.object({
    query: z.string().describe("The search query. Be specific about what information is needed."),
    results_count: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return. Defaults to 3."),
  }),
  execute: async (args) => {
    /* ... */
  },
});
```

### Error Handling

Implement error handling that provides useful feedback to the model.

```typescript
execute: async (args) => {
  try {
    const result = await performOperation(args);
    return result;
  } catch (error) {
    throw new Error(`Failed to process request: ${error.message}`);
  }
};
```

### Timeout Handling

For long-running operations, implement timeouts using `AbortController`.

```typescript
execute: async (args, context) => {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort("Operation timed out");
  }, 5000);

  try {
    // Listen to parent abort if provided
    const parentController = context?.abortController;
    if (parentController?.signal) {
      parentController.signal.addEventListener("abort", () => {
        timeoutController.abort("Parent operation aborted");
        clearTimeout(timeoutId);
      });
    }

    const result = await fetch(url, {
      signal: timeoutController.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};
```

## MCP (Model Context Protocol) Support

VoltAgent supports the [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/mcp), allowing agents to connect with external MCP-compatible servers and tools.

### Using MCP Tools

Connect to MCP servers and use their tools with your agents:

```typescript
import { Agent, MCPConfiguration } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

// Configure MCP servers
const mcpConfig = new MCPConfiguration({
  servers: {
    // HTTP server
    browserTools: {
      type: "http",
      url: "https://your-mcp-server.example.com/browser",
    },
    // Local stdio server
    localAI: {
      type: "stdio",
      command: "python",
      args: ["local_ai_server.py"],
    },
  },
});

// Get tools grouped by server
const toolsets = await mcpConfig.getToolsets();
const browserToolsOnly = toolsets.browserTools.getTools();

// Or get all tools combined
const allMcpTools = await mcpConfig.getTools();

// Create agent with MCP tools
const agent = new Agent({
  name: "MCP-Enhanced Assistant",
  description: "Assistant with MCP tools",
  model: openai("gpt-4o"),
  tools: allMcpTools,
});
```

For detailed MCP setup and usage, see the [MCP documentation](https://voltagent.dev/docs/agents/mcp/).

## Additional Links

- [VoltAgent home](https://voltagent.dev/)
- [Discord](https://s.voltagent.dev/discord)
- [GitHub](https://github.com/voltagent/voltagent)
- [VoltAgent Docs](https://voltagent.dev/docs/)
- [VoltOps Docs](https://voltagent.dev/voltops-llm-observability-docs/)
- [←Agent Instructions](https://voltagent.dev/docs/agents/prompts/)
- [Memory→](https://voltagent.dev/docs/agents/memory/)
