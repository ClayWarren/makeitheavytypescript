import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConfig } from './config';
import * as fs from 'fs';
import * as yaml from 'yaml';

// Mock fs and yaml
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

const mockedFs = vi.mocked(fs);
const mockedYaml = vi.mocked(yaml);

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and parse config successfully', () => {
    const mockConfig = {
      openrouter: {
        api_key: 'test-key',
        base_url: 'https://api.openrouter.ai',
        model: 'test-model',
      },
      system_prompt: 'Test prompt',
      agent: {
        max_iterations: 10,
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

    mockedFs.readFileSync.mockReturnValue('mock yaml content');
    mockedYaml.parse.mockReturnValue(mockConfig);

    const result = loadConfig('test-config.yaml');

    expect(result).toEqual(mockConfig);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith(
      'test-config.yaml',
      'utf8'
    );
    expect(mockedYaml.parse).toHaveBeenCalledWith('mock yaml content');
  });

  it('should use default config path if not provided', () => {
    const mockConfig = { openrouter: { api_key: 'test' } };

    mockedFs.readFileSync.mockReturnValue('content');
    mockedYaml.parse.mockReturnValue(mockConfig);

    loadConfig();

    expect(mockedFs.readFileSync).toHaveBeenCalledWith('config.yaml', 'utf8');
  });

  it('should throw error if file read fails', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    expect(() => loadConfig('nonexistent.yaml')).toThrow(
      'Failed to load config from nonexistent.yaml: Error: File not found'
    );
  });

  it('should throw error if yaml parsing fails', () => {
    mockedFs.readFileSync.mockReturnValue('invalid: yaml: content: [');
    mockedYaml.parse.mockImplementation(() => {
      throw new Error('YAML parse error');
    });

    expect(() => loadConfig('invalid.yaml')).toThrow(
      'Failed to load config from invalid.yaml: Error: YAML parse error'
    );
  });
});
