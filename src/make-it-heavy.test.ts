import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskOrchestrator } from './orchestrator';
import { loadConfig } from './config';
import { OrchestratorCLI } from './make-it-heavy';

// Mock dependencies
vi.mock('./orchestrator');
vi.mock('./config');

const mockedTaskOrchestrator = vi.mocked(TaskOrchestrator);
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

// Mock console methods
const originalClear = console.clear;
const originalLog = console.log;

describe('OrchestratorCLI', () => {
  let mockConfig: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockOrchestrator: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      openrouter: { api_key: 'test', base_url: 'url', model: 'test/model' },
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

    mockOrchestrator = {
      orchestrate: vi.fn().mockResolvedValue('Orchestrator result'),
      getProgressStatus: vi.fn().mockReturnValue(new Map()),
      numAgents: 4,
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    mockedLoadConfig.mockReturnValue(mockConfig);
    mockedTaskOrchestrator.mockImplementation(() => mockOrchestrator);

    // Mock console.clear and console.log
    console.clear = vi.fn();
    console.log = vi.fn();
  });

  afterEach(() => {
    console.clear = originalClear;
    console.log = originalLog;
  });

  describe('constructor', () => {
    it('should initialize orchestrator and set model display', () => {
      const cli = new OrchestratorCLI();

      expect(mockedLoadConfig).toHaveBeenCalled();
      expect(mockedTaskOrchestrator).toHaveBeenCalledWith(mockConfig);
      expect(cli.modelDisplay).toBe('MODEL HEAVY');
    });
  });

  describe('clearScreen', () => {
    it('should call console.clear', () => {
      const cli = new OrchestratorCLI();

      cli.clearScreen();

      expect(console.clear).toHaveBeenCalled();
    });
  });

  describe('formatTime', () => {
    it('should format seconds correctly', () => {
      const cli = new OrchestratorCLI();

      expect(cli.formatTime(30)).toBe('30S');
      expect(cli.formatTime(90)).toBe('1M30S');
      expect(cli.formatTime(3661)).toBe('1H1M');
    });
  });

  describe('createProgressBar', () => {
    it('should create progress bar for QUEUED', () => {
      const cli = new OrchestratorCLI();

      const bar = cli.createProgressBar('QUEUED');
      expect(bar).toContain('○');
      expect(bar).toContain('·'.repeat(70));
    });

    it('should create progress bar for PROCESSING...', () => {
      const cli = new OrchestratorCLI();

      const bar = cli.createProgressBar('PROCESSING...');
      expect(bar).toContain('●');
      expect(bar).toContain(':');
    });

    it('should create progress bar for COMPLETED', () => {
      const cli = new OrchestratorCLI();

      const bar = cli.createProgressBar('COMPLETED');
      expect(bar).toContain('●');
      expect(bar).toContain(':');
    });

    it('should create progress bar for FAILED', () => {
      const cli = new OrchestratorCLI();

      const bar = cli.createProgressBar('FAILED: error');
      expect(bar).toContain('✗');
      expect(bar).toContain('×');
    });
  });

  describe('updateDisplay', () => {
    it('should update display when running', () => {
      const cli = new OrchestratorCLI();
      cli.running = true;
      cli.startTime = Date.now() - 5000; // 5 seconds ago

      mockOrchestrator.getProgressStatus.mockReturnValue(
        new Map([['0', 'PROCESSING...']])
      );

      cli.updateDisplay();

      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('MODEL HEAVY');
      expect(console.log).toHaveBeenCalledWith('● RUNNING • 5S');
    });

    it('should not update when not running', () => {
      const cli = new OrchestratorCLI();
      cli.running = false;

      cli.updateDisplay();

      expect(console.clear).not.toHaveBeenCalled();
    });
  });

  describe('progressMonitor', () => {
    it('should set up interval for updating display', () => {
      vi.useFakeTimers();
      const cli = new OrchestratorCLI();

      const updateDisplaySpy = vi.spyOn(cli, 'updateDisplay');

      cli.progressMonitor();

      // Fast-forward 1 second
      vi.advanceTimersByTime(1000);

      expect(updateDisplaySpy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('runTask', () => {
    it('should run task successfully', async () => {
      const cli = new OrchestratorCLI();

      const progressMonitorSpy = vi.spyOn(cli, 'progressMonitor');
      const updateDisplaySpy = vi.spyOn(cli, 'updateDisplay');

      const result = await cli.runTask('Test task');

      expect(progressMonitorSpy).toHaveBeenCalled();
      expect(mockOrchestrator.orchestrate).toHaveBeenCalledWith('Test task');
      expect(result).toBe('Orchestrator result');
      expect(cli.running).toBe(false);
      expect(updateDisplaySpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('='.repeat(80));
      expect(console.log).toHaveBeenCalledWith('FINAL RESULTS');
      expect(console.log).toHaveBeenCalledWith('Orchestrator result');
    });

    it('should handle task failure', async () => {
      mockOrchestrator.orchestrate.mockRejectedValue(new Error('Task failed'));

      const cli = new OrchestratorCLI();

      const result = await cli.runTask('Test task');

      expect(result).toBe(null);
      expect(cli.running).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        '\nError during orchestration: Error: Task failed'
      );
    });
  });

  describe('interactiveMode', () => {
    it('should initialize and start CLI loop', async () => {
      const cli = new OrchestratorCLI();

      // Mock user input: quit
      mockRl.question.mockImplementation((prompt, callback) => {
        callback('quit');
      });

      vi.spyOn(cli, 'runTask').mockResolvedValue('result');

      await cli.interactiveMode();

      expect(console.log).toHaveBeenCalledWith('Multi-Agent Orchestrator');
      expect(console.log).toHaveBeenCalledWith(
        'Configured for 4 parallel agents'
      );
      expect(console.log).toHaveBeenCalledWith('Using model: test/model');
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should handle initialization error', async () => {
      mockedLoadConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      expect(() => new OrchestratorCLI()).toThrow('Config error');
    });

    it('should process user input', async () => {
      const cli = new OrchestratorCLI();

      // First call: user input, second call: quit
      mockRl.question
        .mockImplementationOnce((prompt, callback) => {
          callback('Test task');
        })
        .mockImplementationOnce((prompt, callback) => {
          callback('quit');
        });

      const runTaskSpy = vi.spyOn(cli, 'runTask').mockResolvedValue('result');

      await cli.interactiveMode();

      expect(runTaskSpy).toHaveBeenCalledWith('Test task');
      expect(console.log).toHaveBeenCalledWith(
        '\nOrchestrator: Starting multi-agent analysis...'
      );
      expect(mockRl.close).toHaveBeenCalled();
    });
  });
});

describe('main', () => {
  it('should create CLI and run interactive mode', async () => {
    const { main } = await import('./make-it-heavy');

    await main();

    // The main function creates OrchestratorCLI and calls interactiveMode
    // Since interactiveMode is tested above, we just verify it runs
    expect(mockedLoadConfig).toHaveBeenCalled();
    expect(mockedTaskOrchestrator).toHaveBeenCalled();
  });
});
