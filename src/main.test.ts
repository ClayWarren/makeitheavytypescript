import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenRouterAgent } from './agent';
import { loadConfig } from './config';

// Mock dependencies
vi.mock('./agent');
vi.mock('./config');

const mockedOpenRouterAgent = vi.mocked(OpenRouterAgent);
const mockedLoadConfig = vi.mocked(loadConfig);

// Mock readline
const mockRl = {
  question: vi.fn(),
  close: vi.fn(),
};

vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn().mockReturnValue(mockRl),
  },
}));

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize agent successfully and start CLI loop', async () => {
    const mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'model' },
      system_prompt: 'prompt',
      agent: { max_iterations: 5 },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: '',
        synthesis_prompt: '',
      },
      search: { max_results: 5, user_agent: 'agent' },
    };

    const mockAgent = {
      run: vi.fn().mockResolvedValue('Agent response'),
    };

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Import and call main
    const { main } = await import('./main');
    await main();

    expect(mockedLoadConfig).toHaveBeenCalled();
    expect(mockedOpenRouterAgent).toHaveBeenCalledWith(mockConfig);
    expect(mockAgent.run).not.toHaveBeenCalled(); // Not called until user input
  });

  it('should handle initialization error', async () => {
    const error = new Error('Config error');
    mockedLoadConfig.mockImplementation(() => {
      throw error;
    });

    // Mock console.log to capture output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { main } = await import('./main');
    await main();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error initializing agent: Error: Config error'
    );
    expect(consoleSpy).toHaveBeenCalledWith('Make sure you have:');
    expect(consoleSpy).toHaveBeenCalledWith(
      '1. Set your OpenRouter API key in config.yaml'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '2. Installed all dependencies with: npm install'
    );

    consoleSpy.mockRestore();
  });

  it('should handle quit command', async () => {
    const mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'model' },
      system_prompt: 'prompt',
      agent: { max_iterations: 5 },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: '',
        synthesis_prompt: '',
      },
      search: { max_results: 5, user_agent: 'agent' },
    };

    const mockAgent = {
      run: vi.fn(),
    };

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Simulate user input: quit
    mockRl.question.mockImplementation((prompt, callback) => {
      callback('quit');
    });

    const { main } = await import('./main');
    await main();

    expect(mockRl.close).toHaveBeenCalled();
  });

  it('should handle empty input', async () => {
    const mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'model' },
      system_prompt: 'prompt',
      agent: { max_iterations: 5 },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: '',
        synthesis_prompt: '',
      },
      search: { max_results: 5, user_agent: 'agent' },
    };

    const mockAgent = {
      run: vi.fn(),
    };

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // First call: empty input, second call: quit
    mockRl.question
      .mockImplementationOnce((prompt, callback) => {
        callback('');
      })
      .mockImplementationOnce((prompt, callback) => {
        callback('quit');
      });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { main } = await import('./main');
    await main();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Please enter a question or command.'
    );
    expect(mockRl.close).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should process user input and get agent response', async () => {
    const mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'model' },
      system_prompt: 'prompt',
      agent: { max_iterations: 5 },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: '',
        synthesis_prompt: '',
      },
      search: { max_results: 5, user_agent: 'agent' },
    };

    const mockAgent = {
      run: vi.fn().mockResolvedValue('Agent response'),
    };

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // First call: user input, second call: quit
    mockRl.question
      .mockImplementationOnce((prompt, callback) => {
        callback('Hello agent');
      })
      .mockImplementationOnce((prompt, callback) => {
        callback('quit');
      });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { main } = await import('./main');
    await main();

    expect(mockAgent.run).toHaveBeenCalledWith('Hello agent');
    expect(consoleSpy).toHaveBeenCalledWith('Agent: Thinking...');
    expect(consoleSpy).toHaveBeenCalledWith('Agent: Agent response');
    expect(mockRl.close).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle agent error', async () => {
    const mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'model' },
      system_prompt: 'prompt',
      agent: { max_iterations: 5 },
      orchestrator: {
        parallel_agents: 4,
        task_timeout: 300,
        aggregation_strategy: 'consensus',
        question_generation_prompt: '',
        synthesis_prompt: '',
      },
      search: { max_results: 5, user_agent: 'agent' },
    };

    const mockAgent = {
      run: vi.fn().mockRejectedValue(new Error('Agent error')),
    };

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedOpenRouterAgent.mockImplementation(() => mockAgent as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // First call: user input, second call: quit
    mockRl.question
      .mockImplementationOnce((prompt, callback) => {
        callback('Hello agent');
      })
      .mockImplementationOnce((prompt, callback) => {
        callback('quit');
      });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { main } = await import('./main');
    await main();

    expect(consoleSpy).toHaveBeenCalledWith('Error: Error: Agent error');
    expect(consoleSpy).toHaveBeenCalledWith(
      "Please try again or type 'quit' to exit."
    );
    expect(mockRl.close).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
