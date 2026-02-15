/**
 * Issue Discovery API
 * 
 * Automated issue detection via static analysis
 * GET /api/issues - List discovered issues with filters
 * POST /api/issues - Create issue (for testing)
 */

import { NextRequest, NextResponse } from 'next/server';

interface DiscoveredIssue {
  id: string;
  projectId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'bug' | 'security' | 'code-smell' | 'performance' | 'style';
  file: string;
  line: number;
  column?: number;
  rule: string;
  message: string;
  suggestion?: string;
  discoveredAt: string;
  agentOwner: string;
  status: 'new' | 'acknowledged' | 'resolved' | 'false-positive';
}

// In-memory store (TODO: move to database)
const issues: DiscoveredIssue[] = [];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const severity = searchParams.get('severity');
  const category = searchParams.get('category');
  const projectId = searchParams.get('projectId');
  const agentOwner = searchParams.get('agentOwner');
  const status = searchParams.get('status');
  
  let filtered = issues;
  
  if (severity) filtered = filtered.filter(i => i.severity === severity);
  if (category) filtered = filtered.filter(i => i.category === category);
  if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
  if (agentOwner) filtered = filtered.filter(i => i.agentOwner === agentOwner);
  if (status) filtered = filtered.filter(i => i.status === status);
  
  return NextResponse.json({
    issues: filtered,
    total: filtered.length,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const issue: DiscoveredIssue = {
    id: crypto.randomUUID(),
    projectId: body.projectId || 'mission-control',
    severity: body.severity || 'medium',
    category: body.category || 'code-smell',
    file: body.file,
    line: body.line,
    column: body.column,
    rule: body.rule,
    message: body.message,
    suggestion: body.suggestion,
    discoveredAt: new Date().toISOString(),
    agentOwner: body.agentOwner || 'dev',
    status: 'new',
  };
  
  issues.push(issue);
  
  return NextResponse.json(issue, { status: 201 });
}
