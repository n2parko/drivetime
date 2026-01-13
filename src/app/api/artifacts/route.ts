import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, CreateArtifactInput } from '@/types/artifact';
import { saveArtifact, getAllArtifacts, getDayGroups } from '@/lib/store';

// Demo user ID - in production, use authentication
const DEMO_USER_ID = 'demo-user';

// CORS headers for ChatGPT widget access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const artifacts = await getAllArtifacts(DEMO_USER_ID);
    const dayGroups = await getDayGroups(DEMO_USER_ID);

    return NextResponse.json({
      artifacts,
      dayGroups,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifacts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateArtifactInput = await request.json();
    const { type, content, sourceUrl, imageData, tags = [] } = body;

    const now = new Date();
    const dayBucket = now.toISOString().split('T')[0];

    // Simple save - just store the content as-is (like Pocket)
    const title = content.slice(0, 100) + (content.length > 100 ? '...' : '');

    const artifact: Artifact = {
      id: uuidv4(),
      userId: DEMO_USER_ID,
      type: imageData ? 'screenshot' : sourceUrl ? 'article' : type,
      title,
      rawContent: content,
      sourceUrl,
      imageData,
      status: 'pending',
      createdAt: now.toISOString(),
      tags,
      dayBucket,
    };

    await saveArtifact(artifact);

    return NextResponse.json(artifact, { headers: corsHeaders });
  } catch (error) {
    console.error('Error creating artifact:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create artifact', details: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}
