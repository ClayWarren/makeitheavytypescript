import { describe, it, expect } from 'vitest';
import { TaskDoneTool } from './task-done-tool';

describe('TaskDoneTool', () => {
  const mockConfig = {};
  const tool = new TaskDoneTool(mockConfig);

  it('should return completion status with provided summary and message', () => {
    const taskSummary = 'Task completed successfully';
    const completionMessage = 'The task has been finished.';

    const result = tool.execute(taskSummary, completionMessage);

    expect(result).toEqual({
      status: 'completed',
      task_summary: taskSummary,
      completion_message: completionMessage,
      timestamp: expect.any(String), // Should be an ISO string
    });

    // Verify timestamp is a valid ISO string
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');
  });

  it('should handle empty strings for summary and message', () => {
    const taskSummary = '';
    const completionMessage = '';

    const result = tool.execute(taskSummary, completionMessage);

    expect(result).toEqual({
      status: 'completed',
      task_summary: '',
      completion_message: '',
      timestamp: expect.any(String),
    });
  });

  it('should handle long strings for summary and message', () => {
    const taskSummary = 'A'.repeat(1000);
    const completionMessage = 'B'.repeat(1000);

    const result = tool.execute(taskSummary, completionMessage);

    expect(result.task_summary).toBe(taskSummary);
    expect(result.completion_message).toBe(completionMessage);
    expect(result.status).toBe('completed');
    expect(result.timestamp).toBeDefined();
  });
});
