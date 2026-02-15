// Mission Control - Task Pause API
// Pauses a task and stops any associated autonomous agent session
import { NextRequest, NextResponse } from 'next/server';
import { updateTask, getTask } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();
    
    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Get task details
    const task = getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if there's an active autonomous session for the assigned agent
    let autonomousSessionStopped = false;
    if (task.assignedTo) {
      const sessionPath = path.join(
        process.env.HOME || '/home/broklein',
        '.openclaw/autonomous',
        `${task.assignedTo}.session`
      );
      
      try {
        const sessionData = await fs.readFile(sessionPath, 'utf-8');
        const session = JSON.parse(sessionData);
        
        // Check if session is active and related to this task
        if (session.status === 'active') {
          // Stop the autonomous session
          const { stdout, stderr } = await execAsync(
            `~/.openclaw/hooks/autonomous-mode-v3.sh stop ${task.assignedTo}`
          );
          
          autonomousSessionStopped = true;
          console.log(`Stopped autonomous session for ${task.assignedTo}:`, stdout);
          
          if (stderr) {
            console.warn(`Autonomous stop stderr:`, stderr);
          }
        }
      } catch (error: any) {
        // Session file doesn't exist or not parseable - that's OK
        if (error.code !== 'ENOENT') {
          console.warn(`Error checking autonomous session:`, error);
        }
      }
    }

    // Update task status to paused
    const updatedTask = updateTask(taskId, { status: 'paused' });
    
    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      task: updatedTask,
      autonomousSessionStopped,
      message: autonomousSessionStopped 
        ? `Task paused and autonomous session stopped for ${task.assignedTo}`
        : 'Task paused'
    });
  } catch (error) {
    console.error('Task pause error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
