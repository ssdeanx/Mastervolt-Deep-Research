# Reasoning Tools (`think` & `analyze`)

VoltAgent offers `think` and `analyze` tools, bundled via a `Toolkit` helper, to give agents step-by-step reasoning abilities. This helps agents break down problems, plan, analyze results internally, and structure their thought process before responding.

## What are the `think` and `analyze` tools?

Inspired by structured reasoning techniques, these tools allow the agent to perform an internal monologue ("stop and think") during complex tasks. Instead of attempting a direct response, the agent performs explicit reasoning steps:

- Break Down Complexity: Deconstruct multi-step problems or unclear requests using `think`.
- Plan Actions: Decide the next steps, necessary tool calls, or required information using `think`.
- Analyze Information: Evaluate information gathered from other tools or previous steps using `analyze`.
- Improve Reliability: Verify intermediate steps and logic to reduce errors before finalizing the response.
- Handle Complex Instructions: Follow detailed guidelines or policies step-by-step using `think` and `analyze`.

### When to Use

Use the `reasoning_tools` toolkit when the agent needs to:

1. Perform Sequential Tool Calls: Plan sequences (`think`) and evaluate intermediate results (`analyze`).
2. Analyze Tool Outputs Carefully: Process, verify, or synthesize results from tools before proceeding (`analyze`).
3. Navigate Complex Rules/Policies: Use `think` to understand rules and plan compliant actions, then `analyze` to check outcomes.
4. Make Sequential Decisions: Reduce errors in multi-step processes (e.g., complex bookings, calculations, data processing).
5. Plan Complex Tasks: Break down ambiguous problems and determine how to gather information incrementally (`think`).

### When Less Necessary

- Simple, single-step tasks that require only one tool call or a direct answer.
- Straightforward instructions without complex decisions or dependencies.

## The `createReasoningTools` Helper

Use the `@voltagent/core` helper `createReasoningTools` to easily add the reasoning tools to your agent:

```typescript
import { createReasoningTools, type Toolkit } from "@voltagent/core";

// Basic usage - includes both tools and adds instructions/examples
const reasoningToolkit: Toolkit = createReasoningTools();

// Customized usage - e.g., only include 'think' and don't add instructions
const thinkOnlyToolkit: Toolkit = createReasoningTools({
  analyze: false,
  addInstructions: false,
});
```

This returns a `Toolkit` named `"reasoning_tools"`. Toolkits are a convenient way to bundle related tools and manage shared instructions. The `reasoning_tools` toolkit contains:

1. `think` Tool: An internal scratchpad for the agent to plan, outline steps, and structure its thoughts.
2. `analyze` Tool: A tool for the agent to evaluate results (from `think` or other tools) and decide the next move (`continue`, `validate`, or `final_answer`).
3. Detailed Instructions & Examples (Optional): Explains how the agent should use the tools iteratively. These are added to the agent's system prompt if `addInstructions: true` (which is the default).

### Options for `createReasoningTools`

```typescript
type CreateReasoningToolsOptions = {
  /**
   * Add detailed instructions and few-shot examples to the agent's system prompt.
   * @default true
   */
  addInstructions?: boolean;
  /**
   * Include the 'think' tool in the toolkit.
   * @default true
   */
  think?: boolean;
  /**
   * Include the 'analyze' tool in the toolkit.
   * @default true
   */
  analyze?: boolean;
  /**
   * Include default few-shot examples along with instructions (if addInstructions is true).
   * @default true
   */
  addFewShot?: boolean;
  /**
   * Provide custom few-shot examples instead of the default ones.
   * Ignored if addInstructions or addFewShot is false.
   * @default Predefined examples (see code)
   */
  fewShotExamples?: string;
};
```

## Key Usage Instructions & Guidelines

If `addInstructions` is `true` (default), the agent's system prompt is augmented with guidance. Key guidelines include:

- Always Think First: You MUST use the 'think' tool before making other tool calls or generating a response, unless the request is extremely simple. Use 'think' multiple times to break down complex problems.
- Iterate to Solve: Use the 'think' and 'analyze' tools iteratively. The typical flow is `Think` -> [`Think` -> ...] -> [Tool Calls if needed] -> [`Analyze` if needed] -> ... -> `final_answer`. Repeat this cycle until you reach a satisfactory conclusion.
- Make multiple tool calls in parallel: After a 'think' step planning multiple actions, you can make multiple tool calls in parallel if needed.
- Keep Thoughts Internal: The reasoning steps (thoughts and analyses) are for your internal process only. Do not share them directly with the user unless asked to explain your reasoning.
- Conclude Clearly: When your analysis determines the `next_action` is `final_answer`, provide a concise and accurate final answer to the user based on your reasoning steps.

(These instructions are accompanied by few-shot examples demonstrating the flow if `addFewShot` is `true`).

## How the Agent Uses the Tools (Internal Flow)

The power of these tools lies in how the agent uses them internally before generating a response for the user. Here's a simplified example based on the default few-shot examples provided to the agent:

**User Request:** What is the capital of France and its current population?

**Agent's Internal Process (simplified):**

1. **Initial Thought:** The agent calls `think` to break down the request.
   - `think({ title: "Plan Information Retrieval", thought: "User needs two facts: capital and population. First, find the capital.", action: "Search for capital of France" })`

2. **(Optional) External Tool Call:** The agent might call a search tool: `search({ query: "capital of France" })`. Assume the result is "Paris".

3. **Analysis & Next Step:** The agent calls `analyze` to process the result.
   - `analyze({ title: "Analyze Capital Result", result: "Search result: Paris", analysis: "Got the capital (Paris). Now need population.", next_action: "continue" })`

4. **Further Thought:** Since the `next_action` was `continue`, the agent calls `think` again.
   - `think({ title: "Plan Population Retrieval", thought: "Next step: find population of Paris.", action: "Search for population of Paris" })`

5. **(Optional) External Tool Call:** Agent calls `search({ query: "population of Paris" })`. Assume result is "~2.1 million".

6. **Final Analysis:** Agent analyzes the second result.
   - `analyze({ title: "Analyze Population Result", result: "Search result: ~2.1 million", analysis: "Have both capital and population. Ready to answer.", next_action: "final_answer" })`

**Agent's Final Answer to User:** (Generated after the internal reasoning)

> The capital of France is Paris. Its estimated population is approximately 2.1 million.

### Key Tool Parameters

When the agent calls `think` or `analyze`, it uses parameters like:

- `title`: A short label for the reasoning step (useful for tracing).
- `thought` (`think` only): The agent's detailed reasoning or plan.
- `action` (`think` only): The intended next step (e.g., call a specific tool, formulate the final answer).
- `result` (`analyze` only): The outcome being analyzed (e.g., output from another tool).
- `analysis` (`analyze` only): The agent's evaluation of the `result`.
- `next_action` (`analyze` only): The crucial decision: `continue` (more steps needed), `validate` (seek external confirmation), or `final_answer` (ready to respond to user).
- `confidence`: An optional score (0.0-1.0) indicating the agent's confidence in its thought or analysis.

## Example Agent Setup

![River Crossing Puzzle](https://cdn.voltagent.dev/docs/reasoning-demo.gif)

```typescript
import { Agent, createReasoningTools, type Toolkit } from "@voltagent/core";
import { openai } from "@ai-sdk/openai";

// Get toolkit, automatically adding instructions & examples to system prompt
const reasoningToolkit: Toolkit = createReasoningTools(); // Uses defaults

const agent = new Agent({
  name: "ThinkingAgent",
  instructions: `
    You are an AI assistant designed for complex problem-solving using structured reasoning.
    You MUST use the 'think' and 'analyze' tools internally to break down problems, plan steps,
    evaluate information, and decide on the best course of action before responding.
    Always think step-by-step.
  `,
  model: openai("gpt-4o-mini"), // Ensure model supports tool use
  tools: [
    reasoningToolkit,
    // ... add other tools the agent can call after thinking/analyzing
    // e.g., searchTool, databaseQueryTool, etc.
  ],
  markdown: true,
});

// Example invocation (River Crossing Puzzle)
const result = await agent.generateText(`
  Three project managers (PMs) and three engineers (ENGs) need to cross a river.
  The boat holds only two people. At no point, on either river bank, can the engineers
  outnumber the project managers (otherwise, chaos ensues!). How can they all cross safely?
`);
console.log(result);
// The agent will perform think/analyze steps internally
```

[GitHub Logo Get the code example for this article on GitHub](https://github.com/VoltAgent/voltagent/tree/main/examples/with-thinking-tool)

To run this example locally:

`npm create voltagent-app@latest -- --example with-thinking-tool`

Using these tools encourages a structured, internal thought process, leading to more reliable and explainable agent behavior, especially for complex tasks.

## Best Practices

1. **Leverage Defaults:** Start with `createReasoningTools()` which enables all features (`think`, `analyze`, instructions, examples). This provides the best initial guidance to the agent.

2. **Reinforce in Agent Description:** Briefly mention in the agent's `description` that it should use the `think` and `analyze` tools for structured reasoning, complementing the detailed instructions added to the system prompt.

3. **Provide Other Tools:** Reasoning tools are most effective when the agent can plan (`think`) to use other tools (like search, database access, calculations) and then evaluate (`analyze`) their results.

4. **Use Capable Models:** Ensure the underlying LLM (`model`) is proficient at following instructions and using tools effectively (e.g., GPT-4, Claude 3).

5. **Custom Examples for Nuance:** If the default few-shot examples aren't sufficient for your specific domain or complex workflows, provide tailored examples using the `fewShotExamples` option.

6. **Monitor and Refine:** Observe the agent's internal reasoning steps (tool calls like `think` and `analyze`) using tools like the [VoltAgent VoltOps Platform](https://voltagent.dev/docs/observability/developer-console/) to identify areas where its logic could be improved. Refine the agent's `description` or provide custom `fewShotExamples` based on these observations.

7. **Start with Complex Cases:** Introduce reasoning tools for tasks where the agent struggles with multi-step logic, planning, or managing information from multiple sources.

## Additional Links

- [VoltAgent home](https://voltagent.dev/)
- [Discord](https://s.voltagent.dev/discord)
- [GitHub](https://github.com/voltagent/voltagent)
- [VoltAgent Docs](https://voltagent.dev/docs/)
- [VoltOps Docs](https://voltagent.dev/voltops-llm-observability-docs/)
- [←Overview](https://voltagent.dev/docs/tools/overview/)
- [Overview→](https://voltagent.dev/docs/rag/overview/)
