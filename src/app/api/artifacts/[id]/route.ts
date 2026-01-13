import { NextRequest, NextResponse } from 'next/server';
import { getArtifact, updateArtifactStatus, deleteArtifact } from '@/lib/store';

// CORS headers for ChatGPT widget access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artifact = await getArtifact(id);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(artifact, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching artifact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifact' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, ...additionalFields } = body;

    const updated = await updateArtifactStatus(id, status, additionalFields);

    if (!updated) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(updated, { headers: corsHeaders });
  } catch (error) {
    console.error('Error updating artifact:', error);
    return NextResponse.json(
      { error: 'Failed to update artifact' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteArtifact(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return NextResponse.json(
      { error: 'Failed to delete artifact' },
      { status: 500, headers: corsHeaders }
    );
  }
}
