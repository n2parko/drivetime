import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function summarizeContent(content: string, type: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that creates concise, audio-friendly summaries.
The summary should be:
- 2-3 sentences max
- Written to be spoken aloud (natural speech patterns)
- Capture the key insight or main point
- Engaging and conversational

The content type is: ${type}`,
      },
      {
        role: 'user',
        content: `Please summarize this for audio playback:\n\n${content}`,
      },
    ],
    max_tokens: 300,
  });

  return response.choices[0]?.message?.content || content.slice(0, 500);
}

export async function expandForAudio(content: string, type: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant that prepares content for audio playback.
Transform the content to be:
- Natural and conversational for spoken delivery
- Well-structured with clear transitions
- Engaging to listen to
- Complete but not overly long (aim for 1-2 minutes of speaking)

The content type is: ${type}`,
      },
      {
        role: 'user',
        content: `Please prepare this for audio playback:\n\n${content}`,
      },
    ],
    max_tokens: 1000,
  });

  return response.choices[0]?.message?.content || content;
}

export async function extractFromScreenshot(imageBase64: string): Promise<{ title: string; content: string }> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this screenshot and extract the key information.
Return a JSON object with:
- "title": A brief title (5-10 words)
- "content": The main text/information visible, formatted for reading

Return only valid JSON.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 1000,
  });

  const text = response.choices[0]?.message?.content || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If parsing fails, use the raw text
  }

  return {
    title: 'Screenshot',
    content: text,
  };
}

export async function fetchAndSummarizeUrl(url: string): Promise<{ title: string; content: string }> {
  const openai = getOpenAI();

  // Fetch the URL content
  const response = await fetch(url);
  const html = await response.text();

  // Extract text content (basic extraction)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000);

  // Use GPT to extract the main content
  const extraction = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Extract the main article content from this webpage text.
Return a JSON object with:
- "title": The article/page title
- "content": The main content, cleaned up and formatted

Return only valid JSON.`,
      },
      {
        role: 'user',
        content: textContent,
      },
    ],
    max_tokens: 2000,
  });

  const text = extraction.choices[0]?.message?.content || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If parsing fails, return basic content
  }

  return {
    title: url,
    content: textContent.slice(0, 2000),
  };
}

export async function generateTTS(text: string): Promise<Buffer> {
  const openai = getOpenAI();
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    response_format: 'mp3',
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export { getOpenAI as openai };
