import { NextRequest, NextResponse } from 'next/server';
import { getAllArtifacts, getArtifact, updateArtifactStatus, getPendingArtifacts } from '@/lib/store';
import { expandForAudio } from '@/lib/openai';
import { ArtifactType } from '@/types/artifact';

const DEMO_USER_ID = 'demo-user';

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// CORS headers for ChatGPT access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Widget template URI
const WIDGET_URI = 'ui://widget/drivetime.html';

// Tool definitions for ChatGPT Apps SDK
const tools = [
  {
    name: 'show_drivetime',
    description: 'Show the DriveTime inbox widget where users can add ideas, questions, notes, and see their queue. Use this when the user wants to add content or manage their episodes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    _meta: {
      'openai/outputTemplate': WIDGET_URI,
      'openai/toolInvocation/invoking': 'Opening DriveTime...',
      'openai/toolInvocation/invoked': 'DriveTime ready.',
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_todays_episodes',
    description: "Get all episodes queued for today. Use this to start the drive-time audio experience or check what's in the queue.",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'pending', 'completed'],
          description: 'Filter by status. Default is pending.',
        },
      },
    },
    _meta: {
      'openai/toolInvocation/invoking': 'Loading episodes...',
      'openai/toolInvocation/invoked': 'Episodes loaded.',
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_episode_content',
    description: 'Get content of a specific episode to read aloud. Returns the text for ChatGPT to speak.',
    inputSchema: {
      type: 'object',
      properties: {
        episode_id: { type: 'string', description: 'Episode ID' },
        mode: { type: 'string', enum: ['summary', 'full'], description: 'Summary or full content' },
      },
      required: ['episode_id'],
    },
    _meta: {
      'openai/toolInvocation/invoking': 'Preparing episode...',
      'openai/toolInvocation/invoked': 'Ready to play.',
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
    },
  },
  {
    name: 'mark_episode_complete',
    description: 'Mark an episode as completed after listening.',
    inputSchema: {
      type: 'object',
      properties: {
        episode_id: { type: 'string', description: 'Episode ID' },
      },
      required: ['episode_id'],
    },
    _meta: {
      'openai/toolInvocation/invoking': 'Marking complete...',
      'openai/toolInvocation/invoked': 'Done!',
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
  },
  {
    name: 'add_to_queue',
    description: 'Add a new idea, question, note, or article URL to the queue.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['idea', 'question', 'note', 'article'], description: 'Content type' },
        content: { type: 'string', description: 'The content or URL to add' },
      },
      required: ['type', 'content'],
    },
    _meta: {
      'openai/toolInvocation/invoking': 'Adding to queue...',
      'openai/toolInvocation/invoked': 'Added!',
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
    },
  },
];

// Generate widget HTML with injected data (no self-fetch needed)
async function getWidgetHtml(baseUrl: string): Promise<string> {
  // Fetch pending episodes to inject into the widget
  const episodes = await getPendingArtifacts(DEMO_USER_ID);
  const episodesJson = JSON.stringify(episodes.map(a => ({
    id: a.id,
    type: a.type,
    title: a.title,
    summary: a.summary,
    status: a.status,
  })));

  // Return the complete widget HTML with data embedded
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DriveTime</title>
  <script>
    window.__DRIVETIME_CONFIG__ = {
      apiBase: ${JSON.stringify(baseUrl)},
      episodes: ${episodesJson}
    };
  </script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #fafaf9; --card: #ffffff; --fg: #1c1917; --muted: #78716c;
      --border: #e7e5e4; --accent: #3b82f6; --accent-hover: #2563eb;
      --shadow: 0 1px 3px rgba(0,0,0,0.06); --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07);
      --radius: 16px; --radius-sm: 12px;
      --idea: #3b82f6; --question: #8b5cf6; --note: #06b6d4; --article: #10b981;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #09090b; --card: #18181b; --fg: #fafafa; --muted: #a1a1aa;
        --border: #27272a; --shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: var(--bg); color: var(--fg); padding: 20px; line-height: 1.5; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .logo { width: 40px; height: 40px; background: linear-gradient(135deg, var(--accent), #60a5fa); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .logo svg { width: 22px; height: 22px; color: white; }
    .title { font-size: 20px; font-weight: 700; }
    .tagline { font-size: 12px; color: var(--muted); }
    .input-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; }
    .type-selector { display: flex; gap: 8px; margin-bottom: 16px; }
    .type-btn { padding: 8px 14px; border-radius: 24px; font-size: 13px; font-weight: 600; border: 2px solid transparent; cursor: pointer; background: var(--bg); color: var(--muted); transition: all 0.2s; }
    .type-btn.active { color: white; }
    .type-btn.idea.active { background: var(--idea); }
    .type-btn.question.active { background: var(--question); }
    .type-btn.note.active { background: var(--note); }
    textarea { width: 100%; min-height: 80px; background: transparent; border: none; outline: none; resize: none; font-size: 15px; color: var(--fg); font-family: inherit; }
    textarea::placeholder { color: var(--muted); }
    .submit-btn { width: 100%; padding: 14px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; }
    .submit-btn:disabled { opacity: 0.6; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 12px; }
    .episode-list { display: flex; flex-direction: column; gap: 10px; }
    .episode { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; cursor: pointer; position: relative; border-left: 4px solid var(--accent); }
    .episode.idea { border-left-color: var(--idea); }
    .episode.question { border-left-color: var(--question); }
    .episode.note { border-left-color: var(--note); }
    .episode.article { border-left-color: var(--article); }
    .episode-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .episode-type { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
    .empty-state { text-align: center; padding: 40px 20px; background: var(--card); border: 2px dashed var(--border); border-radius: var(--radius); }
    .empty-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .empty-text { font-size: 13px; color: var(--muted); }
    .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 20px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg></div>
    <div><span class="title">DriveTime</span><br><span class="tagline">Audio for your commute</span></div>
  </div>
  <div class="input-card">
    <div class="type-selector">
      <button class="type-btn idea active" data-type="idea">💡 Idea</button>
      <button class="type-btn question" data-type="question">❓ Question</button>
      <button class="type-btn note" data-type="note">📝 Note</button>
    </div>
    <textarea id="content" placeholder="What's on your mind?"></textarea>
    <button class="submit-btn" id="submit">Add to Queue</button>
  </div>
  <div class="section-title">Today's Queue</div>
  <div class="episode-list" id="episodes"><div class="spinner"></div></div>
  <script>
    const config = window.__DRIVETIME_CONFIG__ || {};
    const API_BASE = config.apiBase || window.openai?.toolResponseMetadata?.['openai/widgetDomain'] || '';
    let episodes = config.episodes || [];
    let selectedType = 'idea';

    console.log('[DriveTime] Init - API_BASE:', API_BASE, 'episodes:', episodes.length, 'openai:', !!window.openai);

    const contentEl = document.getElementById('content');
    const submitBtn = document.getElementById('submit');
    const episodesEl = document.getElementById('episodes');
    const typeButtons = document.querySelectorAll('.type-btn');

    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedType = btn.dataset.type;
      });
    });

    submitBtn.addEventListener('click', async () => {
      const content = contentEl.value.trim();
      if (!content) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';
      const isUrl = content.startsWith('http://') || content.startsWith('https://');
      const typeToAdd = isUrl ? 'article' : selectedType;
      try {
        if (window.openai?.callTool) {
          await window.openai.callTool('add_to_queue', { type: typeToAdd, content });
          contentEl.value = '';
          window.openai.sendFollowUpMessage?.('Added to your queue!');
        } else if (API_BASE) {
          const res = await fetch(API_BASE + '/api/artifacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: typeToAdd, content: isUrl ? '' : content, sourceUrl: isUrl ? content : undefined })
          });
          if (res.ok) { contentEl.value = ''; loadEpisodes(); }
        }
      } catch (err) { console.error('[DriveTime] Add error:', err); }
      finally { submitBtn.disabled = false; submitBtn.textContent = 'Add to Queue'; }
    });

    async function loadEpisodes() {
      if (episodes.length > 0) { renderEpisodes(); return; }
      if (!API_BASE) { renderEpisodes(); return; }
      try {
        const res = await fetch(API_BASE + '/api/artifacts');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        episodes = (data.artifacts || []).filter(a => a.status === 'ready' || a.status === 'pending');
        renderEpisodes();
      } catch (err) {
        console.error('[DriveTime] Load error:', err);
        episodesEl.innerHTML = '<div class="empty-state"><div class="empty-title">Failed to load</div><div class="empty-text">' + (err.message || 'Connection error') + '</div></div>';
      }
    }

    function renderEpisodes() {
      if (episodes.length === 0) {
        episodesEl.innerHTML = '<div class="empty-state"><div class="empty-title">Queue empty</div><div class="empty-text">Add an idea, question, or note above</div></div>';
        return;
      }
      episodesEl.innerHTML = episodes.map(ep => 
        '<div class="episode ' + ep.type + '" data-id="' + ep.id + '">' +
        '<div class="episode-type">' + ep.type + '</div>' +
        '<div class="episode-title">' + escapeHtml(ep.title) + '</div></div>'
      ).join('');
      document.querySelectorAll('.episode').forEach(el => {
        el.addEventListener('click', () => {
          if (window.openai?.callTool) {
            window.openai.callTool('get_episode_content', { episode_id: el.dataset.id, mode: 'summary' });
          }
        });
      });
    }

    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    loadEpisodes();
  </script>
</body>
</html>`;
}

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  baseUrl: string
): Promise<{
  structuredContent?: unknown;
  content: { type: string; text: string }[];
  _meta?: Record<string, unknown>;
}> {
  switch (name) {
    case 'show_drivetime': {
      const artifacts = await getPendingArtifacts(DEMO_USER_ID);
      return {
        structuredContent: {
          episodeCount: artifacts.length,
          message: artifacts.length > 0
            ? `You have ${artifacts.length} episode${artifacts.length > 1 ? 's' : ''} ready.`
            : 'Your queue is empty. Add some ideas!',
        },
        content: [
          {
            type: 'text',
            text: artifacts.length > 0
              ? `DriveTime is ready with ${artifacts.length} episode${artifacts.length > 1 ? 's' : ''} in your queue.`
              : 'DriveTime is ready. Your queue is empty - add some ideas, questions, or notes!',
          },
        ],
        _meta: {
          episodes: artifacts.map((a, i) => ({
            id: a.id,
            position: i + 1,
            type: a.type,
            title: a.title,
            summary: a.summary,
          })),
        },
      };
    }

    case 'get_todays_episodes': {
      const status = (args.status as string) || 'pending';
      let artifacts;

      if (status === 'pending') {
        artifacts = await getPendingArtifacts(DEMO_USER_ID);
      } else {
        artifacts = await getAllArtifacts(DEMO_USER_ID);
        if (status === 'completed') {
          artifacts = artifacts.filter(a => a.status === 'completed');
        }
      }

      const episodeList = artifacts.map((a, i) => `${i + 1}. [${a.type.toUpperCase()}] ${a.title}`).join('\n');

      return {
        structuredContent: {
          count: artifacts.length,
          episodes: artifacts.map((a, i) => ({
            id: a.id,
            position: i + 1,
            type: a.type,
            title: a.title,
          })),
        },
        content: [
          {
            type: 'text',
            text: artifacts.length > 0
              ? `Here are your ${artifacts.length} episode${artifacts.length > 1 ? 's' : ''}:\n\n${episodeList}\n\nWant me to read the first one?`
              : 'No episodes in queue. Use show_drivetime to add some!',
          },
        ],
        _meta: {
          episodes: artifacts.map((a, index) => ({
            id: a.id,
            position: index + 1,
            type: a.type,
            title: a.title,
            summary: a.summary,
            rawContent: a.rawContent,
          })),
        },
      };
    }

    case 'get_episode_content': {
      const episodeId = args.episode_id as string;
      const mode = (args.mode as string) || 'summary';

      const artifact = await getArtifact(episodeId);
      if (!artifact) {
        return {
          structuredContent: { error: 'Episode not found' },
          content: [{ type: 'text', text: 'Episode not found.' }],
        };
      }

      await updateArtifactStatus(episodeId, 'playing');

      let contentText = mode === 'full'
        ? artifact.fullAudioText || artifact.rawContent
        : artifact.summary || artifact.rawContent;

      if (mode === 'full' && !artifact.fullAudioText) {
        contentText = await expandForAudio(artifact.rawContent, artifact.type);
      }

      return {
        structuredContent: {
          id: artifact.id,
          type: artifact.type,
          title: artifact.title,
          mode,
        },
        content: [
          {
            type: 'text',
            text: `**${artifact.type.toUpperCase()}: ${artifact.title}**\n\n${contentText}\n\n---\n*Say "next" to continue, "more detail" for full version, or ask me anything about this.*`,
          },
        ],
        _meta: {
          episodeId: artifact.id,
          type: artifact.type,
          sourceUrl: artifact.sourceUrl,
          fullContent: artifact.rawContent,
        },
      };
    }

    case 'mark_episode_complete': {
      const episodeId = args.episode_id as string;
      const updated = await updateArtifactStatus(episodeId, 'completed');

      if (!updated) {
        return {
          structuredContent: { error: 'Episode not found' },
          content: [{ type: 'text', text: 'Episode not found.' }],
        };
      }

      const remaining = await getPendingArtifacts(DEMO_USER_ID);
      return {
        structuredContent: {
          completed: true,
          remainingCount: remaining.length,
        },
        content: [
          {
            type: 'text',
            text: remaining.length > 0
              ? `Done! ${remaining.length} more episode${remaining.length > 1 ? 's' : ''} to go.`
              : 'All done! Your queue is clear.',
          },
        ],
      };
    }

    case 'add_to_queue': {
      const type = args.type as string;
      const content = args.content as string;

      const { v4: uuidv4 } = await import('uuid');
      const { saveArtifact } = await import('@/lib/store');

      const now = new Date();
      const isUrl = content.startsWith('http://') || content.startsWith('https://');
      const title = content.slice(0, 100) + (content.length > 100 ? '...' : '');

      const artifact = {
        id: uuidv4(),
        userId: DEMO_USER_ID,
        type: (isUrl ? 'article' : type) as ArtifactType,
        title,
        rawContent: content,
        sourceUrl: isUrl ? content : undefined,
        status: 'pending' as const,
        createdAt: now.toISOString(),
        tags: [],
        dayBucket: now.toISOString().split('T')[0],
      };

      await saveArtifact(artifact);

      return {
        structuredContent: {
          added: true,
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
        },
        content: [
          {
            type: 'text',
            text: `Saved "${title}" for later.`,
          },
        ],
      };
    }

    default:
      return {
        structuredContent: { error: `Unknown tool: ${name}` },
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body: MCPRequest = await request.json();
    const baseUrl = request.nextUrl.origin;

    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: body.id,
    };

    switch (body.method) {
      case 'initialize':
        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'drivetime',
            version: '1.0.0',
          },
        };
        break;

      case 'tools/list':
        response.result = { tools };
        break;

      case 'tools/call': {
        const params = body.params as { name: string; arguments?: Record<string, unknown> };
        response.result = await handleToolCall(params.name, params.arguments || {}, baseUrl);
        break;
      }

      case 'resources/list':
        response.result = {
          resources: [
            {
              uri: WIDGET_URI,
              name: 'DriveTime Widget',
              description: 'Interactive widget for managing DriveTime episodes',
              mimeType: 'text/html+skybridge',
            },
          ],
        };
        break;

      case 'resources/read': {
        const params = body.params as { uri: string };
        if (params.uri === WIDGET_URI) {
          const widgetHtml = await getWidgetHtml(baseUrl);
          response.result = {
            contents: [
              {
                uri: WIDGET_URI,
                mimeType: 'text/html+skybridge',
                text: widgetHtml,
                _meta: {
                  'openai/widgetPrefersBorder': true,
                  'openai/widgetDomain': baseUrl,
                  'openai/widgetCSP': {
                    connect_domains: [baseUrl],
                    resource_domains: [baseUrl],
                  },
                },
              },
            ],
          };
        } else {
          response.error = { code: -32602, message: `Resource not found: ${params.uri}` };
        }
        break;
      }

      default:
        response.error = { code: -32601, message: `Method not found: ${body.method}` };
    }

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    console.error('MCP error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error' },
    }, { headers: corsHeaders });
  }
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const message = JSON.stringify({
        jsonrpc: '2.0',
        method: 'connection/ready',
        params: { serverName: 'drivetime', version: '1.0.0' },
      });
      controller.enqueue(encoder.encode(`data: ${message}\n\n`));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  });
}
