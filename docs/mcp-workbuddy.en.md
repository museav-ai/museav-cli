# Use MUSE AV in WorkBuddy

Set this up once to query MUSE AV and generate images or videos from WorkBuddy. It takes about five minutes.

> If `museav` is already installed and signed in, start at step 2.

## 1. Install and sign in

Open Terminal and run:

```bash
npm install -g museav-cli
museav login
museav balance
```

`museav login` displays a URL and a code. Open the URL, approve the sign-in, then return to Terminal. If `museav balance` shows your account balance, sign-in worked.

## 2. Copy the full path to `museav`

Run:

```bash
command -v museav
```

Copy the full path it prints, for example `/opt/homebrew/bin/museav`.

## 3. Add MUSE AV in WorkBuddy

In WorkBuddy, open **Experts · Skills · Connectors → Connectors → Custom Connector → MCP Service Management → Add MCP**.

Add this configuration and replace `command` with the path from step 2:

```json
{
  "mcpServers": {
    "museav": {
      "command": "/opt/homebrew/bin/museav",
      "args": ["mcp"]
    }
  }
}
```

If `mcpServers` or other services already exist, **add only the `museav` entry and keep the existing configuration**. Save, click **Trust** for MUSE AV, and reload MCP services if prompted.

## 4. Check the connection

Start a new WorkBuddy conversation and ask:

> List the image and video models currently available in MUSE AV.

If WorkBuddy calls `museav_models` and returns a model list, the connection works. You can also ask “Check my MUSE AV balance,” which uses `museav_balance`.

## Available tools

| Tool | What it does |
| --- | --- |
| `museav_balance` | Check account balance |
| `museav_models` | List available image and video models |
| `museav_skills` | List image skills |
| `museav_templates` | List image and video templates |
| `museav_jobs` | Check recent image-generation jobs |
| `museav_generate_image` | Generate an image |
| `museav_generate_video` | Generate a video |

Image and video generation use your signed-in MUSE AV account and consume credits. Read-only queries do not submit generation jobs. Video generation may take a few minutes; cancelling the conversation may not cancel a job that has already been submitted.

## Troubleshooting

- **WorkBuddy cannot find `museav`:** Run `command -v museav` again and use the full path for `command`.
- **Sign-in or authentication error:** Run `museav balance` in Terminal. If it fails, sign in again with `museav login`.
- **No tools appear:** Make sure you saved the configuration and clicked **Trust**, then reload MCP services or restart WorkBuddy.
- **Configuration will not save:** Check JSON quotes, commas, and braces. JSON does not allow comments. Keep your other MCP services.
- **It stopped working after changing Node.js or reinstalling the CLI:** Run `command -v museav` again and update the path in `command`.

The MCP server reuses your local `museav login` session. You do not need to add an API key or token to the WorkBuddy configuration. See the [WorkBuddy Connector docs](https://open.workbuddy.cn/docs/connector) for more information.
