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

// Get widget HTML content with injected data
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

  // Fetch the widget HTML from the public folder
  try {
    const response = await fetch(`${baseUrl}/widget/index.html`);
    let html = await response.text();
    
    // Inject the API base URL and pre-fetched episodes
    const injectedScript = `
    <script>
      window.__DRIVETIME_CONFIG__ = {
        apiBase: ${JSON.stringify(baseUrl)},
        episodes: ${episodesJson}
      };
    </script>
    `;
    
    // Insert before the closing </head> tag
    html = html.replace('</head>', injectedScript + '</head>');
    
    return html;
  } catch {
    // Fallback: return a minimal widget
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
<div id="root">Loading DriveTime...</div>
<script>
  // Use window.openai to access tool data
  const data = window.openai?.toolOutput || {};
  document.getElementById('root').innerHTML = '<h2>DriveTime</h2><p>' + (data.message || 'Ready') + '</p>';
</script>
</body></html>`;
  }
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('MCP error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal error' },
    });
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
    },
  });
}
