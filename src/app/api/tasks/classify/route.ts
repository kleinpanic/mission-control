/**
 * POST /api/tasks/classify
 * 
 * Classify task complexity using ClawRouter-derived weighted scoring.
 * Zero LLM cost, <1ms response time.
 * 
 * Body: { title: string, description?: string }
 *   OR: { id: string } (classify existing task by ID)
 * 
 * Returns: ClassifyResult with tier, complexity, priority, danger, model, agent recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.id) {
      // Classify existing task by ID
      const result = execSync(
        `oc-tasks classify ${body.id} --format json`,
        { timeout: 5000, encoding: 'utf-8' }
      );
      return NextResponse.json(JSON.parse(result));
    }

    if (!body.title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    // Classify freeform text
    const text = body.description
      ? `${body.title} ${body.description}`
      : body.title;

    const result = execSync(
      `oc-tasks classify --text ${JSON.stringify(text)} --format json`,
      { timeout: 5000, encoding: 'utf-8' }
    );

    return NextResponse.json(JSON.parse(result));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Classification failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tasks/classify?text=...
 * 
 * Quick classification via query parameter.
 */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get('text');

  if (!text) {
    return NextResponse.json(
      { error: 'text query parameter is required' },
      { status: 400 }
    );
  }

  try {
    const result = execSync(
      `oc-tasks classify --text ${JSON.stringify(text)} --format json`,
      { timeout: 5000, encoding: 'utf-8' }
    );
    return NextResponse.json(JSON.parse(result));
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Classification failed' },
      { status: 500 }
    );
  }
}
