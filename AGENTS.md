# MCP Deploy Agent Instructions

## Purpose

You are converting an MCP (Model Context Protocol) server to be deployable on Vercel serverless. Your goal is to create a working MCP endpoint that can be accessed via HTTP.

## CRITICAL: Use the Fork Template Approach

**DO NOT modify the source MCP repo directly.** Instead:

1. **Fork the working template**: `vercel-labs/mcp-on-vercel`
2. **Read the source MCP's `src/index.ts`** to understand its tools
3. **Update `api/server.ts`** in the forked repo with converted tools
4. **Deploy to Vercel**

This approach works because the template has all the correct configurations already.

---

## Working File Structure

```
project/
├── api/
│   └── server.ts       # The MCP handler (THIS IS THE ONLY FILE YOU MODIFY)
├── package.json        # DO NOT CHANGE - template has correct deps
├── tsconfig.json       # DO NOT CHANGE - template has correct config
└── vercel.json         # DO NOT CHANGE - template has correct rewrites
```

---

## How to Convert Tools from Source MCP

### Source Pattern (what you'll find in src/index.ts):

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "example", version: "1.0.0" });

server.tool(
    "tool-name",
    "Tool description",
    {
        param1: z.string().describe("Description"),
        param2: z.number().optional().describe("Optional param"),
    },
    async ({ param1, param2 }) => {
        // implementation
        return { content: [{ type: "text", text: result }] };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Converted Pattern (what you write in api/server.ts):

```typescript
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "tool-name",
      "Tool description",
      {
        param1: z.string().describe("Description"),
        param2: z.number().optional().describe("Optional param"),
      },
      async ({ param1, param2 }) => {
        // implementation (or command generation for CLI tools)
        return { content: [{ type: "text", text: result }] };
      }
    );
  },
  {
    capabilities: {
      tools: {
        "tool-name": { description: "Tool description" }
      }
    }
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: true
  }
);

export default handler;
```

---

## CRITICAL: CLI Tools Cannot Execute on Serverless

If the source MCP uses `node-pty`, `spawn()`, `exec()`, or any CLI execution:

**These DO NOT work on Vercel serverless!**

Instead, convert them to **return the command string** that users can run locally:

### Example: Converting a CLI-based tool

**Source (uses node-pty):**
```typescript
server.tool(
    "do-cero",
    "Execute Cero for subdomain enumeration",
    {
        target: z.string().describe("Target host"),
        concurrency: z.number().optional(),
        ports: z.array(z.string()).optional(),
    },
    async ({ target, concurrency, ports }) => {
        const cero = pty.spawn('cero', [target, ...args]);
        // ... execute and return output
    },
);
```

**Converted (returns command):**
```typescript
server.tool(
  "do-cero",
  "Execute Cero for subdomain enumeration. Returns command to run locally.",
  {
    target: z.string().describe("Target host"),
    concurrency: z.number().optional(),
    ports: z.array(z.string()).optional(),
  },
  async ({ target, concurrency, ports }) => {
    const args: string[] = [target];
    if (concurrency) args.push("-c", String(concurrency));
    if (ports && ports.length > 0) args.push("-p", ports.join(","));

    const command = `cero ${args.join(" ")}`;

    return {
      content: [{
        type: "text",
        text: `To run cero locally, execute:\n\n${command}\n\nRun this on your local machine where cero is installed.`
      }]
    };
  }
);
```

---

## Packages That DO NOT Work on Serverless

Remove these from dependencies if present in source:
- `node-pty` - PTY/terminal emulation
- `execa`, `cross-spawn` - child process helpers
- Any CLI wrapper packages

The only dependencies needed are:
- `mcp-handler` (already in template)
- `zod` (already in template)

---

## Common Mistakes That Cause HTTP 406 Errors

1. **Installing @modelcontextprotocol/sdk directly** - conflicts with mcp-handler
2. **Empty capabilities object** - MUST include tool definitions:
   ```typescript
   // WRONG:
   { capabilities: { tools: {} } }

   // CORRECT:
   { capabilities: { tools: { "tool-name": { description: "..." } } } }
   ```
3. **Using wrong file path** - must be `api/server.ts`, not `app/mcp/route.ts`
4. **Using named exports** - must use `export default handler`
5. **Wrong basePath** - use `basePath: "/api"` for api/server.ts

---

## Verification Checklist

Before deploying, verify:

- [ ] `api/server.ts` uses `createMcpHandler` from `mcp-handler`
- [ ] All tools from source are converted and included
- [ ] Each tool is listed in `capabilities.tools` with description
- [ ] CLI execution code replaced with command generation
- [ ] No `node-pty`, `spawn()`, `exec()` calls remain
- [ ] `export default handler` at the end

---

## Testing the Deployment

After deployment, test with:
```bash
node scripts/test-http-client.mjs https://your-project.vercel.app "/mcp"
```

The endpoint should be at `/mcp` (the template's vercel.json rewrites to this).

---

## Quick Reference: Conversion Steps

1. `github_fork_repo("vercel-labs", "mcp-on-vercel", "source-name-mcp")`
2. `github_read_file(sourceOwner, sourceRepo, "src/index.ts", "main")` - understand tools
3. `github_read_file(yourUsername, "source-name-mcp", "api/server.ts", "main")` - get SHA
4. Convert tools and write: `github_write_file(..., convertedCode, sha, ...)`
5. `vercel_create_project(...)` then `vercel_deploy(...)`
6. Poll `vercel_check_status(...)` until READY
7. `test_mcp_endpoint(productionUrl)` - verify it works
8. If errors, read logs, fix, redeploy - **NEVER GIVE UP**
