import { NextRequest, NextResponse } from 'next/server';
import { getArtifact } from '@/lib/store';
import { generateTTS, expandForAudio } from '@/lib/openai';

export async function POST(request: NextRequest) {
  try {
    const { artifactId, mode = 'summary' } = await request.json();

    if (!artifactId) {
      return NextResponse.json(
        { error: 'Artifact ID is required' },
        { status: 400 }
      );
    }

    const artifact = await getArtifact(artifactId);
    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Prepare text for TTS based on mode
    let textToSpeak: string;
    
    if (mode === 'full') {
      // Expand the content for a longer audio version
      textToSpeak = await expandForAudio(artifact.rawContent, artifact.type);
    } else {
      // Use the summary for a quick listen
      textToSpeak = artifact.summary || artifact.title;
    }

    // Generate TTS audio
    const audioBuffer = await generateTTS(textToSpeak);

    // Return audio as MP3
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate audio', details: message },
      { status: 500 }
    );
  }
}
