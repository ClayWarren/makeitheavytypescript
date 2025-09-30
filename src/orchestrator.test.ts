import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskOrchestrator } from './orchestrator';
import { Config } from './config';
import { OpenRouterAgent } from './agent';

// Mock dependencies
vi.mock('./agent');
vi.mock('./config');

const mockedOpenRouterAgent = vi.mocked(OpenRouterAgent);

describe('TaskOrchestrator', () => {
  let mockConfig: Config;
  let orchestrator: TaskOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      openrouter: {
        api_key: 'test-key',
        base_url: 'https://api.openrouter.ai',
        model: 'test-model',
      },
      system_prompt: 'Test prompt',
      agent: {
        max_iterations: 5,
      },
      orchestrator: {
        parallel_agents: 3,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt:
          'Generate {num_agents} questions for: {user_input}',
        synthesis_prompt:
          'Synthesize {num_responses} responses: {agent_responses}',
      },
      search: {
        max_results: 5,
        user_agent: 'Test Agent',
      },
    };

    orchestrator = new TaskOrchestrator(mockConfig, true);
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(orchestrator['numAgents']).toBe(3);
      expect(orchestrator['taskTimeout']).toBe(300);
      expect(orchestrator['aggregationStrategy']).toBe('consensus');
      expect(orchestrator['silent']).toBe(true);
    });

    it('should initialize progress maps', () => {
      expect(orchestrator.getProgressStatus()).toBeInstanceOf(Map);
      expect(orchestrator.getProgressStatus().size).toBe(0);
    });
  });

  describe('decomposeTask', () => {
    it('should generate questions using AI', async () => {
      const mockAgent = {
        run: vi
          .fn()
          .mockResolvedValue('["Question 1", "Question 2", "Question 3"]'),
        tools: [],
        toolMapping: new Map(),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const questions = await orchestrator.decomposeTask('Test task', 3);

      expect(questions).toEqual(['Question 1', 'Question 2', 'Question 3']);
      expect(mockAgent.run).toHaveBeenCalledWith(
        'Generate 3 questions for: Test task'
      );
    });

    it('should use fallback when AI fails', async () => {
      const mockAgent = {
        run: vi.fn().mockRejectedValue(new Error('AI failed')),
        tools: [],
        toolMapping: new Map(),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const questions = await orchestrator.decomposeTask('Test task', 3);

      expect(questions).toEqual([
        'Research comprehensive information about: Test task',
        'Analyze and provide insights about: Test task',
        'Find alternative perspectives on: Test task',
      ]);
    });

    it('should use fallback for wrong number of questions', async () => {
      const mockAgent = {
        run: vi.fn().mockResolvedValue('["Question 1", "Question 2"]'), // Only 2 instead of 3
        tools: [],
        toolMapping: new Map(),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const questions = await orchestrator.decomposeTask('Test task', 3);

      expect(questions).toEqual([
        'Research comprehensive information about: Test task',
        'Analyze and provide insights about: Test task',
        'Find alternative perspectives on: Test task',
      ]);
    });
  });

  describe('updateAgentProgress', () => {
    it('should update progress and results', () => {
      orchestrator.updateAgentProgress(0, 'PROCESSING...');
      orchestrator.updateAgentProgress(1, 'COMPLETED', 'Result 1');

      const progress = orchestrator.getProgressStatus();
      expect(progress.get(0)).toBe('PROCESSING...');
      expect(progress.get(1)).toBe('COMPLETED');
    });
  });

  describe('runAgentParallel', () => {
    it('should run agent successfully', async () => {
      const mockAgent = {
        run: vi.fn().mockResolvedValue('Agent response'),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await orchestrator.runAgentParallel(0, 'Subtask 1');

      expect(result).toEqual({
        agent_id: 0,
        status: 'success',
        response: 'Agent response',
        execution_time: expect.any(Number),
      });
      expect(mockAgent.run).toHaveBeenCalledWith('Subtask 1');
    });

    it('should handle agent error', async () => {
      const mockAgent = {
        run: vi.fn().mockRejectedValue(new Error('Agent error')),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await orchestrator.runAgentParallel(0, 'Subtask 1');

      expect(result).toEqual({
        agent_id: 0,
        status: 'error',
        response: 'Error: Error: Agent error',
        execution_time: 0,
      });
    });
  });

  describe('aggregateResults', () => {
    it('should return early if no successful results', async () => {
      const results = [
        { agent_id: 0, status: 'error', response: 'Error', execution_time: 0 },
        {
          agent_id: 1,
          status: 'timeout',
          response: 'Timeout',
          execution_time: 300,
        },
      ];

      const aggregated = await orchestrator.aggregateResults(results);

      expect(aggregated).toBe(
        'All agents failed to provide results. Please try again.'
      );
    });

    it('should aggregate successful results', async () => {
      const results = [
        {
          agent_id: 0,
          status: 'success',
          response: 'Response 1',
          execution_time: 100,
        },
        { agent_id: 1, status: 'error', response: 'Error', execution_time: 0 },
        {
          agent_id: 2,
          status: 'success',
          response: 'Response 2',
          execution_time: 150,
        },
      ];

      // Mock the aggregateConsensus method
      const aggregateConsensusSpy = vi.spyOn(
        orchestrator as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        'aggregateConsensus'
      );
      aggregateConsensusSpy.mockResolvedValue('Synthesized response');

      const aggregated = await orchestrator.aggregateResults(results);

      expect(aggregateConsensusSpy).toHaveBeenCalledWith([
        'Response 1',
        'Response 2',
      ]);
      expect(aggregated).toBe('Synthesized response');
    });
  });

  describe('aggregateConsensus', () => {
    it('should return single response if only one', async () => {
      const responses = ['Only response'];

      const result = await orchestrator['aggregateConsensus'](responses);

      expect(result).toBe('Only response');
    });

    it('should synthesize multiple responses', async () => {
      const responses = ['Response 1', 'Response 2', 'Response 3'];

      const mockAgent = {
        run: vi.fn().mockResolvedValue('Synthesized result'),
        tools: [],
        toolMapping: new Map(),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await orchestrator['aggregateConsensus'](responses);

      expect(mockAgent.run).toHaveBeenCalledWith(
        'Synthesize 3 responses: === AGENT 1 RESPONSE ===\nResponse 1\n\n=== AGENT 2 RESPONSE ===\nResponse 2\n\n=== AGENT 3 RESPONSE ===\nResponse 3\n\n'
      );
      expect(result).toBe('Synthesized result');
    });

    it('should fallback to concatenated responses on synthesis failure', async () => {
      const responses = ['Response 1', 'Response 2'];

      const mockAgent = {
        run: vi.fn().mockRejectedValue(new Error('Synthesis failed')),
        tools: [],
        toolMapping: new Map(),
      };
      mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Mock console.log to capture the error log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await orchestrator['aggregateConsensus'](responses);

      expect(result).toBe(
        '=== Agent 1 Response ===\nResponse 1\n\n=== Agent 2 Response ===\nResponse 2\n'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '\n🚨 SYNTHESIS FAILED: Error: Synthesis failed'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '📋 Falling back to concatenated responses\n'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getProgressStatus', () => {
    it('should return a copy of the progress map', () => {
      orchestrator.updateAgentProgress(0, 'QUEUED');
      orchestrator.updateAgentProgress(1, 'PROCESSING...');

      const progress = orchestrator.getProgressStatus();

      expect(progress.get(0)).toBe('QUEUED');
      expect(progress.get(1)).toBe('PROCESSING...');
      expect(progress).toBeInstanceOf(Map);
    });
  });

  describe('orchestrate', () => {
    it('should orchestrate the full process successfully', async () => {
      // Mock decomposeTask
      const decomposeTaskSpy = vi.spyOn(orchestrator, 'decomposeTask');
      decomposeTaskSpy.mockResolvedValue([
        'Subtask 1',
        'Subtask 2',
        'Subtask 3',
      ]);

      // Mock runAgentParallel
      const runAgentParallelSpy = vi.spyOn(orchestrator, 'runAgentParallel');
      runAgentParallelSpy.mockImplementation((id) => {
        return Promise.resolve({
          agent_id: id,
          status: 'success',
          response: `Response for agent ${id}`,
          execution_time: 100,
        });
      });

      // Mock aggregateResults
      const aggregateResultsSpy = vi.spyOn(orchestrator, 'aggregateResults');
      aggregateResultsSpy.mockResolvedValue('Final result');

      const result = await orchestrator.orchestrate('Main task');

      expect(decomposeTaskSpy).toHaveBeenCalledWith('Main task', 3);
      expect(runAgentParallelSpy).toHaveBeenCalledTimes(3);
      expect(aggregateResultsSpy).toHaveBeenCalled();
      expect(result).toBe('Final result');
    });

    it('should handle agent failures in orchestration', async () => {
      // Mock decomposeTask
      const decomposeTaskSpy = vi.spyOn(orchestrator, 'decomposeTask');
      decomposeTaskSpy.mockResolvedValue(['Subtask 1', 'Subtask 2']);

      // Mock runAgentParallel with some failures
      const runAgentParallelSpy = vi.spyOn(orchestrator, 'runAgentParallel');
      runAgentParallelSpy.mockImplementation((id) => {
        if (id === 0) {
          return Promise.resolve({
            agent_id: 0,
            status: 'success',
            response: 'Success response',
            execution_time: 100,
          });
        } else {
          return Promise.resolve({
            agent_id: 1,
            status: 'error',
            response: 'Error response',
            execution_time: 0,
          });
        }
      });

      // Mock aggregateResults
      const aggregateResultsSpy = vi.spyOn(orchestrator, 'aggregateResults');
      aggregateResultsSpy.mockResolvedValue('Final result with failures');

      const result = await orchestrator.orchestrate('Main task');

      expect(result).toBe('Final result with failures');
    });
  });
});
