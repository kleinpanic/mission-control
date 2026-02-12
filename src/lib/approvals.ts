import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const QUEUE_DIR = path.join(process.env.HOME || "~", ".openclaw", "autonomous", "approvals");
const QUEUE_FILE = path.join(QUEUE_DIR, "queue.jsonl");

export interface ApprovalRequest {
  id: string;
  timestamp: string;
  agent: string;
  type: "task" | "action" | "evolution" | "deployment";
  title: string;
  description: string;
  details: any;
  status: "pending" | "approved" | "rejected";
  approvedAt?: string;
  rejectedAt?: string;
  approvedBy?: string;
  notes?: string;
}

/**
 * Ensure the approvals directory and queue file exist
 */
async function ensureQueue(): Promise<void> {
  try {
    await fs.mkdir(QUEUE_DIR, { recursive: true });
    try {
      await fs.access(QUEUE_FILE);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(QUEUE_FILE, "", "utf8");
    }
  } catch (error) {
    console.error("Failed to ensure queue directory:", error);
    throw error;
  }
}

/**
 * Read all approval requests from the queue
 */
export async function readApprovals(): Promise<ApprovalRequest[]> {
  await ensureQueue();
  
  try {
    const content = await fs.readFile(QUEUE_FILE, "utf8");
    const lines = content.trim().split("\n").filter((line) => line.trim());
    
    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as ApprovalRequest;
        } catch {
          return null;
        }
      })
      .filter((req): req is ApprovalRequest => req !== null);
  } catch (error) {
    console.error("Failed to read approvals:", error);
    return [];
  }
}

/**
 * Write all approval requests to the queue (full rewrite)
 */
async function writeApprovals(approvals: ApprovalRequest[]): Promise<void> {
  await ensureQueue();
  
  const content = approvals.map((req) => JSON.stringify(req)).join("\n") + "\n";
  await fs.writeFile(QUEUE_FILE, content, "utf8");
}

/**
 * Add a new approval request to the queue
 */
export async function addApproval(request: Omit<ApprovalRequest, "id" | "timestamp" | "status">): Promise<ApprovalRequest> {
  const approvals = await readApprovals();
  
  const newRequest: ApprovalRequest = {
    ...request,
    id: `approval-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    status: "pending",
  };
  
  approvals.push(newRequest);
  await writeApprovals(approvals);
  
  return newRequest;
}

/**
 * Update an existing approval request
 */
export async function updateApproval(id: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest | null> {
  const approvals = await readApprovals();
  const index = approvals.findIndex((req) => req.id === id);
  
  if (index === -1) {
    return null;
  }
  
  approvals[index] = { ...approvals[index], ...updates };
  await writeApprovals(approvals);
  
  return approvals[index];
}

/**
 * Approve a request and trigger the autonomous action
 */
export async function approveRequest(id: string, notes?: string): Promise<ApprovalRequest | null> {
  const updated = await updateApproval(id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: "Klein", // TODO: Get from session/auth
    notes,
  });
  
  if (!updated) {
    return null;
  }
  
  // Trigger the autonomous action
  try {
    const cmd = `~/.openclaw/hooks/autonomous-mode.sh start ${updated.agent} "${updated.title}" --involvement medium --auto-approved`;
    await execAsync(cmd);
  } catch (error) {
    console.error("Failed to start autonomous mode:", error);
  }
  
  return updated;
}

/**
 * Reject a request
 */
export async function rejectRequest(id: string, notes?: string): Promise<ApprovalRequest | null> {
  return updateApproval(id, {
    status: "rejected",
    rejectedAt: new Date().toISOString(),
    notes,
  });
}

/**
 * Delete an approval request
 */
export async function deleteApproval(id: string): Promise<boolean> {
  const approvals = await readApprovals();
  const filtered = approvals.filter((req) => req.id !== id);
  
  if (filtered.length === approvals.length) {
    return false; // Not found
  }
  
  await writeApprovals(filtered);
  return true;
}

/**
 * Get pending approvals only
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  const approvals = await readApprovals();
  return approvals.filter((req) => req.status === "pending");
}

/**
 * Get approval statistics
 */
export async function getApprovalStats() {
  const approvals = await readApprovals();
  
  return {
    total: approvals.length,
    pending: approvals.filter((req) => req.status === "pending").length,
    approved: approvals.filter((req) => req.status === "approved").length,
    rejected: approvals.filter((req) => req.status === "rejected").length,
  };
}
