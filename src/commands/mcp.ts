import { spawn } from 'node:child_process'
import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024

function runCli(args: string[], signal?: AbortSignal) {
  return new Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }>((resolve, reject) => {
    if (signal?.aborted) {
      resolve({ content: [{ type: 'text', text: 'MCP 调用已取消。' }], isError: true })
      return
    }
    const entry = process.argv[1]
    if (!entry) {
      reject(new Error('无法定位当前 museav CLI 入口'))
      return
    }

    const child = spawn(process.execPath, [entry, ...args], {
      env: { ...process.env, MUSEAV_MCP_CHILD: '1', MUSEAV_NO_WELCOME: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let outputBytes = 0
    let oversized = false
    const abortChild = () => child.kill('SIGTERM')
    signal?.addEventListener('abort', abortChild, { once: true })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk, 'utf8')
      if (outputBytes > MAX_OUTPUT_BYTES) {
        oversized = true
        child.kill()
        return
      }
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      if (Buffer.byteLength(stderr, 'utf8') < MAX_OUTPUT_BYTES) stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abortChild)
      if (signal?.aborted) {
        resolve({ content: [{ type: 'text', text: 'MCP 调用已取消并停止本地 CLI。若生成任务已提交到 MUSE AV，中台仍可能继续生成并扣除额度。' }], isError: true })
        return
      }
      if (oversized) {
        resolve({ content: [{ type: 'text', text: `museav ${args[0]} 输出超过 2 MB，已停止该命令。` }], isError: true })
        return
      }
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim() || `退出码 ${code ?? 'unknown'}`
        resolve({ content: [{ type: 'text', text: `museav ${args[0]} 执行失败：${detail}` }], isError: true })
        return
      }
      resolve({ content: [{ type: 'text', text: stdout.trim() || '命令已完成，没有返回内容。' }] })
    })
  })
}

function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'museav', version })

  server.registerTool('museav_balance', {
    title: '查询 MUSE AV 额度',
    description: '通过 museav balance 查询当前已登录账户的可用额度。',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async () => runCli(['balance']))

  server.registerTool('museav_models', {
    title: '列出 MUSE AV 模型',
    description: '通过 museav models 列出当前可用图片或视频模型。',
    inputSchema: z.object({ mediaType: z.enum(['image', 'video']).default('image') }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ mediaType }) => runCli(mediaType === 'video' ? ['models', '--video'] : ['models']))

  server.registerTool('museav_skills', {
    title: '列出 MUSE AV 出图技能',
    description: '通过 museav skills 列出当前账户可用的出图技能。',
    inputSchema: z.object({ genre: z.string().optional() }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ genre }) => runCli(genre ? ['skills', '--genre', genre] : ['skills']))

  server.registerTool('museav_templates', {
    title: '列出 MUSE AV 模板',
    description: '通过 museav templates 或 museav video-templates 列出当前可用模板。',
    inputSchema: z.object({ mediaType: z.enum(['image', 'video']).default('image') }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ mediaType }) => runCli(mediaType === 'video' ? ['video-templates'] : ['templates']))

  server.registerTool('museav_jobs', {
    title: '查询 MUSE AV 生成记录',
    description: '通过 museav jobs 查询当前账户最近的图片生成任务和结果链接。',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
      status: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
    }),
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ limit, status }) => runCli(['jobs', '--limit', String(limit), ...(status ? ['--status', status] : [])]))

  server.registerTool('museav_generate_image', {
    title: '用 MUSE AV 生成图片',
    description: '通过 museav gen 生成图片，等待完成后返回结果链接。生成会消耗当前账户额度；prompt、skill、templateId 三选一。取消工具调用会停止本地 CLI 等待；如果任务已经提交，中台仍可能继续生成并扣额度。',
    inputSchema: z.object({
      prompt: z.string().min(1).max(7000).optional(),
      skill: z.string().min(1).optional(),
      input: z.string().optional(),
      templateId: z.string().min(1).optional(),
      fields: z.record(z.string(), z.string()).optional(),
      ratio: z.string().optional(),
      quality: z.enum(['low', 'medium', 'high']).optional(),
      references: z.array(z.string().min(1)).max(5).optional(),
      transparent: z.boolean().optional(),
      project: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ prompt, skill, input, templateId, fields, ratio, quality, references, transparent, project }, context) => {
    const selected = [prompt, skill, templateId].filter(Boolean).length
    if (selected !== 1) {
      return { content: [{ type: 'text' as const, text: 'prompt、skill、templateId 必须且只能填写一个。' }], isError: true }
    }
    const args = ['gen']
    if (prompt) args.push('--prompt', prompt)
    if (skill) args.push('--skill', skill)
    if (input) args.push('--input', input)
    if (templateId) args.push('--template', templateId)
    if (fields) args.push('--fields', JSON.stringify(fields))
    if (ratio) args.push('--ratio', ratio)
    if (quality) args.push('--quality', quality)
    for (const reference of references ?? []) args.push('--ref', reference)
    if (transparent) args.push('--transparent')
    if (project) args.push('--project', project)
    return runCli(args, context.mcpReq.signal)
  })

  server.registerTool('museav_generate_video', {
    title: '用 MUSE AV 生成视频',
    description: '通过 museav gen --video 生成视频，等待完成后返回结果链接。生成会消耗当前账户额度。取消工具调用会停止本地 CLI 等待；如果任务已经提交，中台仍可能继续生成并扣额度。',
    inputSchema: z.object({
      prompt: z.string().min(1).max(7000),
      model: z.string().optional(),
      ratio: z.string().optional(),
      duration: z.number().int().min(1).max(30).optional(),
      image: z.string().optional(),
      lastFrame: z.string().optional(),
      referenceImages: z.array(z.string().min(1)).max(9).optional(),
      referenceVideos: z.array(z.string().min(1)).max(3).optional(),
      referenceAudios: z.array(z.string().min(1)).max(3).optional(),
      enhance: z.boolean().optional(),
      project: z.string().optional(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async ({ prompt, model, ratio, duration, image, lastFrame, referenceImages, referenceVideos, referenceAudios, enhance, project }, context) => {
    const args = ['gen', '--video', '--prompt', prompt]
    if (model) args.push('--model', model)
    if (ratio) args.push('--ratio', ratio)
    if (duration) args.push('--duration', String(duration))
    if (image) args.push('--image', image)
    if (lastFrame) args.push('--last-frame', lastFrame)
    for (const reference of referenceImages ?? []) args.push('--reference-image', reference)
    for (const reference of referenceVideos ?? []) args.push('--reference-video', reference)
    for (const reference of referenceAudios ?? []) args.push('--reference-audio', reference)
    if (enhance) args.push('--enhance')
    if (project) args.push('--project', project)
    return runCli(args, context.mcpReq.signal)
  })

  return server
}

export async function startMcpServer(version: string): Promise<void> {
  await serveStdio(() => createServer(version))
}
