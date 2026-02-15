import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const EVOLVER_DIR = path.join(
  process.env.HOME || "~",
  ".openclaw",
  "skills",
  "capability-evolver"
);
const GENES_FILE = path.join(EVOLVER_DIR, "assets", "gep", "genes.json");
const CAPSULES_FILE = path.join(EVOLVER_DIR, "assets", "gep", "capsules.json");
const EVENTS_FILE = path.join(EVOLVER_DIR, "assets", "gep", "events.jsonl");
const PENDING_FILE = path.join(EVOLVER_DIR, "assets", "gep", "pending.jsonl");

export interface Gene {
  type: "Gene";
  id: string;
  category: string;
  signals_match: string[];
  preconditions: string[];
  strategy: string[];
  constraints?: {
    max_files?: number;
    forbidden_paths?: string[];
  };
  validation?: string[];
  enabled?: boolean; // Custom field for UI control
}

export interface Capsule {
  type: "Capsule";
  id: string;
  description: string;
  learned_from?: string;
  timestamp?: string;
}

export interface EvolutionEvent {
  type: "EvolutionEvent";
  id: string;
  timestamp: string;
  gene_id: string;
  parent?: string;
  signals: any;
  mutation: {
    description: string;
    files_changed: string[];
    blast_radius: string;
  };
  outcome: "success" | "failure" | "pending";
  validation_result?: any;
}

export interface PendingEvolution {
  id: string;
  timestamp: string;
  gene_id: string;
  title: string;
  description: string;
  proposed_changes: any;
  status: "pending" | "approved" | "rejected";
}

/**
 * Read genes from the genes.json file
 */
export async function readGenes(): Promise<Gene[]> {
  try {
    const content = await fs.readFile(GENES_FILE, "utf8");
    const data = JSON.parse(content);
    return data.genes || [];
  } catch (error) {
    console.error("Failed to read genes:", error);
    return [];
  }
}

/**
 * Read capsules from capsules.json
 */
export async function readCapsules(): Promise<Capsule[]> {
  try {
    const content = await fs.readFile(CAPSULES_FILE, "utf8");
    const data = JSON.parse(content);
    return data.capsules || [];
  } catch (error) {
    console.error("Failed to read capsules:", error);
    return [];
  }
}

/**
 * Read evolution events from events.jsonl
 */
export async function readEvents(): Promise<EvolutionEvent[]> {
  try {
    const content = await fs.readFile(EVENTS_FILE, "utf8");
    const lines = content.trim().split("\n").filter((line) => line.trim());

    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as EvolutionEvent;
        } catch {
          return null;
        }
      })
      .filter((event): event is EvolutionEvent => event !== null);
  } catch {
    // File might not exist yet
    return [];
  }
}

/**
 * Read pending evolutions
 */
export async function readPendingEvolutions(): Promise<PendingEvolution[]> {
  try {
    const content = await fs.readFile(PENDING_FILE, "utf8");
    const lines = content.trim().split("\n").filter((line) => line.trim());

    return lines
      .map((line) => {
        try {
          return JSON.parse(line) as PendingEvolution;
        } catch {
          return null;
        }
      })
      .filter((evo): evo is PendingEvolution => evo !== null);
  } catch {
    return [];
  }
}

/**
 * Write pending evolutions
 */
async function writePendingEvolutions(evolutions: PendingEvolution[]): Promise<void> {
  const content = evolutions.map((evo) => JSON.stringify(evo)).join("\n") + "\n";
  await fs.writeFile(PENDING_FILE, content, "utf8");
}

/**
 * Approve a pending evolution
 */
export async function approveEvolution(id: string): Promise<boolean> {
  const evolutions = await readPendingEvolutions();
  const index = evolutions.findIndex((evo) => evo.id === id);

  if (index === -1) {
    return false;
  }

  evolutions[index].status = "approved";
  await writePendingEvolutions(evolutions);

  // Trigger the evolution
  try {
    const cmd = `cd ${EVOLVER_DIR} && node index.js --apply-pending ${id}`;
    await execAsync(cmd);
  } catch (error) {
    console.error("Failed to apply evolution:", error);
  }

  return true;
}

/**
 * Reject a pending evolution
 */
export async function rejectEvolution(id: string): Promise<boolean> {
  const evolutions = await readPendingEvolutions();
  const index = evolutions.findIndex((evo) => evo.id === id);

  if (index === -1) {
    return false;
  }

  evolutions[index].status = "rejected";
  await writePendingEvolutions(evolutions);

  return true;
}

/**
 * Toggle a gene's enabled status
 */
export async function toggleGene(geneId: string, enabled: boolean): Promise<boolean> {
  try {
    const genes = await readGenes();
    const gene = genes.find((g) => g.id === geneId);

    if (!gene) {
      return false;
    }

    gene.enabled = enabled;

    // Write back to genes.json
    const content = await fs.readFile(GENES_FILE, "utf8");
    const data = JSON.parse(content);
    data.genes = genes;
    await fs.writeFile(GENES_FILE, JSON.stringify(data, null, 2), "utf8");

    return true;
  } catch (error) {
    console.error("Failed to toggle gene:", error);
    return false;
  }
}

/**
 * Get evolution statistics
 */
export async function getEvolverStats() {
  const [genes, capsules, events, pending] = await Promise.all([
    readGenes(),
    readCapsules(),
    readEvents(),
    readPendingEvolutions(),
  ]);

  return {
    totalGenes: genes.length,
    enabledGenes: genes.filter((g) => g.enabled !== false).length,
    totalCapsules: capsules.length,
    totalEvents: events.length,
    successfulEvolutions: events.filter((e) => e.outcome === "success").length,
    failedEvolutions: events.filter((e) => e.outcome === "failure").length,
    pendingEvolutions: pending.filter((e) => e.status === "pending").length,
  };
}

/**
 * Trigger an evolution run (in review mode)
 */
export async function triggerEvolutionReview(): Promise<{ output: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(`cd ${EVOLVER_DIR} && node index.js --review`);
    return { output: stdout, error: stderr };
  } catch (error: any) {
    return { output: "", error: error.message };
  }
}
