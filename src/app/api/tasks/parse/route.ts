// Mission Control - Natural Language Task Parser
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Call OpenClaw gateway to use Gemini Flash for parsing
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || '';

    const prompt = `You are a task parser for a task management system. Parse this natural language task into structured fields.

Input: "${text}"

Extract:
- title: The main task description (required)
- description: Additional details if any (optional)
- dueDate: ISO date if mentioned (e.g., "tomorrow", "friday", "feb 15" → "2026-02-15T00:00:00Z"), null if not mentioned
- priority: low, medium, high, or critical (infer from urgency words like "urgent", "asap", "when you can")
- assignedTo: agent ID if mentioned (e.g., "for dev", "dev should", "assign to ops") - use agent IDs: main, dev, school, ops, research, taskmaster, meta
- tags: array of relevant tags extracted from context (e.g., "code", "bug", "urgent", "school", "homework")

Respond in JSON format:
{
  "title": "string",
  "description": "string or null",
  "dueDate": "ISO date string or null",
  "priority": "low|medium|high|critical",
  "assignedTo": "agent id or null",
  "tags": ["tag1", "tag2"]
}`;

    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'google-gemini-cli/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a task parser. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response (handle markdown code blocks if present)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonContent);

    // Validate required field
    if (!parsed.title) {
      return NextResponse.json({ error: 'Could not parse task title' }, { status: 400 });
    }

    // Set defaults
    const task = {
      title: parsed.title,
      description: parsed.description || '',
      dueDate: parsed.dueDate || null,
      priority: parsed.priority || 'medium',
      assignedTo: parsed.assignedTo || null,
      tags: parsed.tags || [],
      status: 'intake', // All NL-created tasks start in intake
      type: 'ui',
      list: 'agents',
    };

    return NextResponse.json({ task });
  } catch (error) {
    console.error('NL parse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
