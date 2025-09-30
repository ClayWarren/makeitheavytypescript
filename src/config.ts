import * as fs from 'fs';
import * as yaml from 'yaml';

export interface Config {
  openrouter: {
    api_key: string;
    base_url: string;
    model: string;
  };
  system_prompt: string;
  agent: {
    max_iterations: number;
  };
  orchestrator: {
    parallel_agents: number;
    task_timeout: number;
    aggregation_strategy: string;
    question_generation_prompt: string;
    synthesis_prompt: string;
  };
  search: {
    max_results: number;
    user_agent: string;
  };
}

export function loadConfig(configPath: string = 'config.yaml'): Config {
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.parse(fileContents) as Config;
    return config;
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}
