# 在 WorkBuddy 里使用 MUSE AV

按下面步骤设置一次，就能在 WorkBuddy 对话里查询 MUSE AV 信息和生成图片、视频。整个过程约 5 分钟。

> 如果你已经装好 `museav` 并登录过，直接从第 2 步开始。

## 1. 安装并登录 MUSE AV

打开「终端」，逐行运行：

```bash
npm install -g museav-cli
museav login
museav balance
```

`museav login` 会显示网页和验证码。打开网页并批准登录，再回到终端；`museav balance` 能显示账户额度就说明登录成功。

## 2. 复制 `museav` 的完整路径

在终端运行：

```bash
command -v museav
```

复制输出的完整路径。比如：

```text
/opt/homebrew/bin/museav
```

## 3. 在 WorkBuddy 添加 MUSE AV

在 WorkBuddy 里依次打开：**专家 · 技能 · 连接器 → 连接器 → 自定义连接器 → MCP 服务管理 → 添加 MCP**。

在配置中加入下面这段，把 `command` 的值换成第 2 步复制的路径：

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

如果配置里已经有 `mcpServers` 或其他服务，**只添加 `museav` 这一项，保留原有内容**。不要把整份配置覆盖掉。保存后，在 MUSE AV 这一项上点击**信任**；如果页面提示重载 MCP 服务，就按提示重载。

## 4. 验证连接

新开一个 WorkBuddy 对话，输入：

> 列出 MUSE AV 当前可用的图片和视频模型。

WorkBuddy 调用 `museav_models` 并返回模型列表，就表示连接成功。也可以问「查询我的 MUSE AV 额度」，对应工具是 `museav_balance`。

## 可以调用什么

| 工具 | 用途 |
| --- | --- |
| `museav_balance` | 查询账户额度 |
| `museav_models` | 查询可用图片和视频模型 |
| `museav_skills` | 查询图片技能 |
| `museav_templates` | 查询图片和视频模板 |
| `museav_jobs` | 查询最近的图片生成任务 |
| `museav_generate_image` | 生成图片 |
| `museav_generate_video` | 生成视频 |

图片和视频生成会使用当前登录的 MUSE AV 账户并扣除相应额度。只查询信息不会提交生成任务。视频生成可能需要等待几分钟；取消对话不一定能取消已提交的生成任务。

## 遇到问题时

- **WorkBuddy 找不到 `museav`**：重新运行 `command -v museav`，确认 `command` 填的是完整路径，而不是只写 `museav`。
- **提示未登录或认证失败**：回到终端运行 `museav balance`；若失败，重新运行 `museav login`。
- **配置后没有工具**：确认已保存并点击「信任」，然后重载 MCP 服务或重启 WorkBuddy。
- **配置保存失败**：检查 JSON 的双引号、逗号和大括号；JSON 里不能加注释。不要删除其他 MCP 服务配置。
- **更换了 Node.js 或重装 CLI 后连不上**：再运行 `command -v museav`，并把新路径更新到 `command`。

MCP 会复用本机 `museav login` 的登录状态，不需要在 WorkBuddy 配置里填写 API Key 或 Token。更多信息见 [WorkBuddy 连接器文档](https://open.workbuddy.cn/docs/connector)。
