# WorkBuddy MCP

`museav mcp` starts a local MCP server over stdio. It invokes the existing `museav` CLI commands, so WorkBuddy uses the same `museav login` account and does not need a second API key.

## Setup

1. Install and sign in to the CLI:

   ```bash
   npm install -g museav-cli@latest
   museav login
   museav balance
   ```

2. Find the CLI executable path:

   ```bash
   command -v museav
   ```

3. In WorkBuddy's MCP configuration, add this entry under `mcpServers`. Replace `/absolute/path/to/museav` with the path from the previous command, and preserve other configured servers:

   ```json
   {
     "mcpServers": {
       "museav": {
         "command": "/absolute/path/to/museav",
         "args": ["mcp"]
       }
     }
   }
   ```

4. Save the configuration, reload WorkBuddy's MCP servers, then try `museav_balance` or `museav_models`.

## Tools

- `museav_balance`: read the current account balance.
- `museav_models`: list image or video models.
- `museav_skills`: list image skills.
- `museav_templates`: list image or video templates.
- `museav_jobs`: inspect recent image generation jobs.
- `museav_generate_image`: submit an image generation request and return its output URL.
- `museav_generate_video`: submit a video generation request and return its output URL.

Image and video generation use the signed-in account and consume its MUSE AV credits. The server calls the CLI with an argument array and does not invoke a shell. Do not place API keys or tokens in this MCP configuration.
