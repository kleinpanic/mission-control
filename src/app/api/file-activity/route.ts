// Mission Control - File Activity API
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const OPENCLAW_HOME = path.join(os.homedir(), '.openclaw');
const LOGS_DIR = path.join(OPENCLAW_HOME, 'logs');

interface FileActivity {
  file: string;
  touchCount: number;
  lastTouched: string;
  operations: string[];
}

export async function GET(_request: NextRequest) {
  try {
    const auditPath = path.join(LOGS_DIR, 'audit-trail.jsonl');
    const content = await fs.readFile(auditPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    const fileMap = new Map<string, FileActivity>();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Look for file operations in the audit trail
        const files = extractFiles(entry);
        
        for (const file of files) {
          if (!fileMap.has(file)) {
            fileMap.set(file, {
              file,
              touchCount: 0,
              lastTouched: entry.timestamp || new Date().toISOString(),
              operations: [],
            });
          }
          
          const activity = fileMap.get(file)!;
          activity.touchCount++;
          activity.lastTouched = entry.timestamp || activity.lastTouched;
          
          if (entry.operation && !activity.operations.includes(entry.operation)) {
            activity.operations.push(entry.operation);
          }
        }
      } catch {
        // Skip malformed lines
        continue;
      }
    }

    const activities = Array.from(fileMap.values())
      .sort((a, b) => b.touchCount - a.touchCount)
      .slice(0, 50); // Top 50 most touched files

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('File activity API error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze file activity',
        activities: []
      },
      { status: 500 }
    );
  }
}

function extractFiles(entry: any): string[] {
  const files: string[] = [];
  
  // Check common fields
  if (entry.file) files.push(entry.file);
  if (entry.path) files.push(entry.path);
  if (entry.filePath) files.push(entry.filePath);
  
  // Check tool calls
  if (entry.toolCalls) {
    for (const call of entry.toolCalls) {
      if (call.parameters?.file_path) files.push(call.parameters.file_path);
      if (call.parameters?.path) files.push(call.parameters.path);
    }
  }
  
  // Extract from message
  if (entry.message) {
    const fileRegex = /\b([a-zA-Z0-9_\-/.]+\.(ts|js|tsx|jsx|py|go|rs|json|md|txt))\b/g;
    const matches = entry.message.matchAll(fileRegex);
    for (const match of matches) {
      files.push(match[1]);
    }
  }
  
  return [...new Set(files)]; // Deduplicate
}
