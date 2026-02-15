import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { taskId, model } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    const db = getDb();
    const task = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as any;

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Use LLM to decompose the task
    const decomposition = await decomposeTaskWithLLM(task, model);

    return NextResponse.json({
      ok: true,
      taskId,
      subtasks: decomposition.subtasks,
      reasoning: decomposition.reasoning,
    });
  } catch (error) {
    console.error("[Task Decomposition] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function decomposeTaskWithLLM(
  task: any,
  modelOverride?: string
): Promise<{ subtasks: any[]; reasoning: string }> {
  // Call OpenClaw gateway to use configured model for decomposition
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";

  const prompt = `You are a task decomposition assistant. Break down this task into smaller, actionable subtasks.

**Task:** ${task.title}
**Description:** ${task.description || "No description provided"}
**Priority:** ${task.priority}
**Complexity:** ${task.complexity || "unknown"}

Decompose this into 3-7 subtasks. Each subtask should:
- Be independently completable
- Have clear acceptance criteria
- Be smaller in scope than the parent
- Maintain the context of the parent task

Respond in JSON format:
{
  "reasoning": "Brief explanation of the decomposition strategy",
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "What needs to be done",
      "priority": "critical|high|medium|low",
      "complexity": "trivial|simple|moderate",
      "estimatedMinutes": 30
    }
  ]
}`;

  // DECOMPOSITION PIPELINE ONLY: Gemini OAuth → API keys → Local (Ollama) fallback
  // This provider chain is ONLY for task decomposition, not for agents
  const preferredModel = modelOverride || process.env.DECOMPOSE_MODEL || "google-gemini-cli/gemini-3-flash-preview";
  
  const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gatewayToken}`,
    },
    body: JSON.stringify({
      model: preferredModel,
      messages: [
        {
          role: "system",
          content:
            "You are a task decomposition expert. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error("No response from LLM");
  }

  // Parse JSON response (handle markdown code blocks if present)
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }

  const result = JSON.parse(jsonContent);

  return {
    reasoning: result.reasoning || "No reasoning provided",
    subtasks: result.subtasks || [],
  };
}
