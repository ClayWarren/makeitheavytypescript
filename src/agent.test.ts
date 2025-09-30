import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenRouterAgent } from './agent';
import { Config } from './config';
import { OpenAI } from 'openai';

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

const mockedOpenAI = vi.mocked(OpenAI);

describe('OpenRouterAgent', () => {
  let mockConfig: Config;
  let mockClient: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      openrouter: {
        api_key: 'test-key',
        base_url: 'https://api.openrouter.ai',
        model: 'test-model',
      },
      system_prompt: 'Test system prompt',
      agent: {
        max_iterations: 5,
      },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: 'Generate questions...',
        synthesis_prompt: 'Synthesize responses...',
      },
      search: {
        max_results: 5,
        user_agent: 'Test Agent',
      },
    };

    mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    mockedOpenAI.mockReturnValue(mockClient);
  });

  describe('constructor', () => {
    it('should initialize OpenAI client with correct config', () => {
      new OpenRouterAgent(mockConfig);

      expect(mockedOpenAI).toHaveBeenCalledWith({
        baseURL: mockConfig.openrouter.base_url,
        apiKey: mockConfig.openrouter.api_key,
      });
    });

    it('should discover tools and build tools array and mapping', () => {
      const agent = new OpenRouterAgent(mockConfig, true);

      expect(agent.tools).toBeDefined();
      expect(agent.toolMapping).toBeDefined();
      expect(agent.tools.length).toBeGreaterThan(0);
      expect(agent.toolMapping.size).toBeGreaterThan(0);
    });
  });

  describe('callLLM', () => {
    it('should call OpenAI API and return response', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      };
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const agent = new OpenRouterAgent(mockConfig, true);
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = await agent.callLLM(messages);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: mockConfig.openrouter.model,
        messages: messages,
        tools: agent.tools,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on API failure', async () => {
      const error = new Error('API Error');
      mockClient.chat.completions.create.mockRejectedValue(error);

      const agent = new OpenRouterAgent(mockConfig, true);

      await expect(agent.callLLM([])).rejects.toThrow(
        'LLM call failed: Error: API Error'
      );
    });
  });

  describe('handleToolCall', () => {
    it('should handle valid tool call', () => {
      const agent = new OpenRouterAgent(mockConfig, true);

      // Mock a tool in the mapping
      const mockTool = {
        execute: vi.fn().mockReturnValue({ result: 'tool output' }),
      };
      agent.toolMapping.set('test_tool', mockTool.execute);

      const toolCall = {
        id: 'call_123',
        function: {
          name: 'test_tool',
          arguments: JSON.stringify({ arg: 'value' }),
        },
      };

      const result = agent.handleToolCall(toolCall);

      expect(mockTool.execute).toHaveBeenCalledWith({ arg: 'value' });
      expect(result).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        name: 'test_tool',
        content: JSON.stringify({ result: 'tool output' }),
      });
    });

    it('should handle unknown tool', () => {
      const agent = new OpenRouterAgent(mockConfig, true);

      const toolCall = {
        id: 'call_123',
        function: {
          name: 'unknown_tool',
          arguments: '{}',
        },
      };

      const result = agent.handleToolCall(toolCall);

      expect(result).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        name: 'unknown_tool',
        content: JSON.stringify({ error: 'Unknown tool: unknown_tool' }),
      });
    });

    it('should handle tool execution error', () => {
      const agent = new OpenRouterAgent(mockConfig, true);

      const mockTool = {
        execute: vi.fn().mockImplementation(() => {
          throw new Error('Tool error');
        }),
      };
      agent.toolMapping.set('failing_tool', mockTool.execute);

      const toolCall = {
        id: 'call_123',
        function: {
          name: 'failing_tool',
          arguments: '{}',
        },
      };

      const result = agent.handleToolCall(toolCall);

      expect(result).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        name: 'failing_tool',
        content: JSON.stringify({
          error: 'Tool execution failed: Error: Tool error',
        }),
      });
    });
  });

  describe('run', () => {
    it('should run agent loop and return response without tool calls', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Final response' } }],
      };
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const agent = new OpenRouterAgent(mockConfig, true);

      const result = await agent.run('Test input');

      expect(result).toBe(
        'Final response\n\nFinal response\n\nFinal response\n\nFinal response\n\nFinal response'
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(5);
    });

    it('should handle tool calls in the loop', async () => {
      const responseWithTool = {
        choices: [
          {
            message: {
              content: 'I need to use a tool',
              tool_calls: [
                {
                  id: 'call_1',
                  function: { name: 'test_tool', arguments: '{}' },
                },
              ],
            },
          },
        ],
      };

      const responseWithoutTool = {
        choices: [{ message: { content: 'Final response' } }],
      };

      mockClient.chat.completions.create
        .mockResolvedValueOnce(responseWithTool)
        .mockResolvedValue(responseWithoutTool);

      const agent = new OpenRouterAgent(mockConfig, true);

      const mockTool = {
        execute: vi.fn().mockReturnValue({ result: 'tool result' }),
      };
      agent.toolMapping.set('test_tool', mockTool.execute);

      const result = await agent.run('Test input');

      expect(result).toBe(
        'I need to use a tool\n\nFinal response\n\nFinal response\n\nFinal response\n\nFinal response'
      );
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(5);
      expect(mockTool.execute).toHaveBeenCalledWith({});
    });

    it('should handle task completion tool', async () => {
      const responseWithCompletion = {
        choices: [
          {
            message: {
              content: 'Task completed',
              tool_calls: [
                {
                  id: 'call_1',
                  function: { name: 'mark_task_complete', arguments: '{}' },
                },
              ],
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(
        responseWithCompletion
      );

      const agent = new OpenRouterAgent(mockConfig, true);

      const result = await agent.run('Test input');

      expect(result).toBe('Task completed');
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should respect max iterations', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
      };
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const agent = new OpenRouterAgent(mockConfig, true);

      await agent.run('Test input');

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(5);
    });
  });
});
