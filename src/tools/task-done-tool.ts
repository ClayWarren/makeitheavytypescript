import { BaseTool, ToolResult, ToolParameters } from './base-tool';

export class TaskDoneTool extends BaseTool {
  constructor(private config: Record<string, unknown>) {
    super();
  }

  get name(): string {
    return 'mark_task_complete';
  }

  get description(): string {
    return "REQUIRED: Call this tool when the user's original request has been fully satisfied and you have provided a complete answer. This signals task completion and exits the agent loop.";
  }

  get parameters(): ToolParameters {
    return {
      type: 'object',
      properties: {
        task_summary: {
          type: 'string',
          description: 'Brief summary of what was accomplished',
        },
        completion_message: {
          type: 'string',
          description:
            'Message to show the user indicating the task is complete',
        },
      },
      required: ['task_summary', 'completion_message'],
    };
  }

  execute(taskSummary: string, completionMessage: string): ToolResult {
    return {
      status: 'completed',
      task_summary: taskSummary,
      completion_message: completionMessage,
      timestamp: new Date().toISOString(),
    };
  }
}
