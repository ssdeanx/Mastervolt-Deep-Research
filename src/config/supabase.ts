import { google } from "@ai-sdk/google";
import { AiSdkEmbeddingAdapter, InMemoryVectorAdapter, Memory } from "@voltagent/core";
import { SupabaseMemoryAdapter } from "@voltagent/supabase";

// Using URL and key
export const supaMemory = new Memory({
  storage: new SupabaseMemoryAdapter({
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_KEY!,
  }),
  workingMemory: {
    enabled: true,
    scope: "user", // persist across conversations
    template: `
# User Profile
- Name:
- Role:
- Timezone:

# Current Goals
-

# Preferences
-
`,
  },
  embedding: new AiSdkEmbeddingAdapter(google.textEmbedding("gemini-embedding-001")),
  vector: new InMemoryVectorAdapter(),
  enableCache: true, // optional embedding cache
});


