// Mission Control - Natural Language Task Parser
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const prompt = `You are a task parser for a task management system. Parse this natural language task into structured fields.

Input: "${text}"

Extract:
- title: The main task description (required)
- description: Additional details if any (optional)
- dueDate: ISO date if mentioned (e.g., "tomorrow", "friday", "feb 15" → "2026-02-15T00:00:00Z"), null if not mentioned
- priority: low, medium, high, or critical (infer from urgency words like "urgent", "asap", "when you can")
- assignedTo: agent ID if mentioned (e.g., "for dev", "dev should", "assign to ops") - use agent IDs: main, dev, school, ops, research, taskmaster, meta
- tags: array of relevant tags extracted from context (e.g., "code", "bug", "urgent", "school", "homework")

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "title": "string",
  "description": "string or null",
  "dueDate": "ISO date string or null",
  "priority": "low|medium|high|critical",
  "assignedTo": "agent id or null",
  "tags": ["tag1", "tag2"]
}`;

    // Use openclaw agent with Gemini Flash (cheap)
    const command = `openclaw agent --agent research --message ${JSON.stringify(prompt)} --model google-gemini-cli/gemini-3-flash-preview --thinking none`;
    
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    if (stderr && !stderr.includes('[plugins]')) {
      console.warn('gemini stderr:', stderr);
    }

    let content = stdout.trim();
    
    // Extract JSON from response (sometimes wrapped in markdown)
    if (content.includes('```json')) {
      const match = content.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        content = match[1];
      }
    } else if (content.includes('```')) {
      const match = content.match(/```\n?([\s\S]*?)\n?```/);
      if (match) {
        content = match[1];
      }
    }
    
    const parsed = JSON.parse(content);

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
