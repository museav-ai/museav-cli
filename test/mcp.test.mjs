import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, test } from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

let mockApi
let tempHome
let imageRequest
let videoRequest
let resolveCancelRequestStarted
const cancelRequestStarted = new Promise((resolveStarted) => { resolveCancelRequestStarted = resolveStarted })
let cancelApiConnectionClosed = false

after(async () => {
  if (mockApi?.listening) await new Promise((resolveClose, reject) => mockApi.close((error) => error ? reject(error) : resolveClose()))
  if (tempHome) await rm(tempHome, { recursive: true, force: true })
})

test('museav mcp lists tools and relays CLI calls without shell interpolation', async () => {
  tempHome = await mkdtemp(join(tmpdir(), 'museav-mcp-'))
  mockApi = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      imageRequest = await readJson(request)
      if (imageRequest.prompt === 'cancel this test') {
        response.on('close', () => { cancelApiConnectionClosed = true })
        resolveCancelRequestStarted()
        return
      }
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ jobId: 'image-job' }))
      return
    }
    if (url.pathname === '/api/jobs' && url.searchParams.get('id') === 'image-job') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ jobId: 'image-job', status: 'done', cdn_url: 'https://cdn.museav.top/mcp-image.png' }))
      return
    }
    if (url.pathname === '/api/videos' && request.method === 'POST') {
      videoRequest = await readJson(request)
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ id: 'video-job' }))
      return
    }
    if (url.pathname === '/api/videos' && url.searchParams.get('id') === 'video-job') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ status: 'completed', cdn_url: 'https://cdn.museav.top/mcp-video.mp4' }))
      return
    }
    if (url.pathname !== '/api/available-models') {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'not found' }))
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify([{ label: 'MCP Smoke Model', value: 'mcp-smoke-model' }]))
  })
  await new Promise((resolveListen, reject) => {
    mockApi.once('error', reject)
    mockApi.listen(0, '127.0.0.1', resolveListen)
  })
  const address = mockApi.address()
  assert.ok(address && typeof address !== 'string')

  const client = new Client({ name: 'museav-mcp-test', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/index.js'), 'mcp'],
    env: {
      ...process.env,
      HOME: tempHome,
      MUSEAV_BASE_URL: `http://127.0.0.1:${address.port}`,
      MUSEAV_API_KEY: 'fixture',
      MUSEAV_NO_WELCOME: '1',
    },
    stderr: 'pipe',
  })

  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    assert.equal(tools.length, 7)
    assert.ok(tools.some((tool) => tool.name === 'museav_generate_image'))
    assert.ok(tools.some((tool) => tool.name === 'museav_generate_video'))

    const result = await client.callTool({ name: 'museav_models', arguments: { mediaType: 'image' } })
    assert.notEqual(result.isError, true, JSON.stringify(result))
    assert.ok(result.content.some((item) => item.type === 'text' && item.text.includes('mcp-smoke-model')))

    const image = await client.callTool({
      name: 'museav_generate_image',
      arguments: { prompt: 'kite; echo not-a-shell', ratio: '1:1', references: ['https://cdn.example.test/ref.png'] },
    })
    assert.notEqual(image.isError, true, JSON.stringify(image))
    assert.ok(image.content.some((item) => item.type === 'text' && item.text.includes('mcp-image.png')))
    assert.deepEqual(imageRequest, { prompt: 'kite; echo not-a-shell', ratio: '1:1', reference_image: 'https://cdn.example.test/ref.png' })

    const video = await client.callTool({
      name: 'museav_generate_video',
      arguments: { prompt: 'a kite moving in the wind', model: 'seedance', ratio: '16:9', duration: 5, image: 'https://cdn.example.test/first.png' },
    })
    assert.notEqual(video.isError, true, JSON.stringify(video))
    assert.ok(video.content.some((item) => item.type === 'text' && item.text.includes('mcp-video.mp4')))
    assert.deepEqual(videoRequest, {
      prompt: 'a kite moving in the wind',
      model: 'seedance',
      ratio: '16:9',
      duration: 5,
      image_url: 'https://cdn.example.test/first.png',
      first_frame: 'https://cdn.example.test/first.png',
    })

    const abortController = new AbortController()
    const cancelledCall = client.callTool({
      name: 'museav_generate_image',
      arguments: { prompt: 'cancel this test' },
    }, { signal: abortController.signal })
    await cancelRequestStarted
    abortController.abort()
    await assert.rejects(cancelledCall)
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    assert.equal(cancelApiConnectionClosed, true)
  } finally {
    await client.close()
  }
})

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { body += chunk })
    request.on('error', rejectBody)
    request.on('end', () => {
      try { resolveBody(JSON.parse(body)) } catch (error) { rejectBody(error) }
    })
  })
}
