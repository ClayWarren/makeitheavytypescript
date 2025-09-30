import { OpenRouterAgent } from './agent';
import { Config } from './config';

interface AgentResult {
  agent_id: number;
  status: string;
  response: string;
  execution_time: number;
}

export class TaskOrchestrator {
  private numAgents: number;
  private taskTimeout: number;
  private aggregationStrategy: string;
  private silent: boolean;
  private agentProgress: Map<number, string>;
  private agentResults: Map<number, string>;

  constructor(
    private config: Config,
    silent: boolean = false
  ) {
    this.numAgents = config.orchestrator.parallel_agents;
    this.taskTimeout = config.orchestrator.task_timeout;
    this.aggregationStrategy = config.orchestrator.aggregation_strategy;
    this.silent = silent;
    this.agentProgress = new Map();
    this.agentResults = new Map();
  }

  async decomposeTask(userInput: string, numAgents: number): Promise<string[]> {
    // Create question generation agent
    const questionAgent = new OpenRouterAgent(this.config, true);

    // Get question generation prompt from config
    const promptTemplate = this.config.orchestrator.question_generation_prompt;
    const generationPrompt = promptTemplate
      .replace('{user_input}', userInput)
      .replace('{num_agents}', numAgents.toString());

    // Remove task completion tool to avoid issues
    questionAgent.tools = questionAgent.tools.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tool: any) => tool.function.name !== 'mark_task_complete'
    );
    questionAgent.toolMapping.delete('mark_task_complete');

    try {
      // Get AI-generated questions
      const response = await questionAgent.run(generationPrompt);

      // Parse JSON response
      const questions = JSON.parse(response.trim());

      // Validate we got the right number of questions
      if (questions.length !== numAgents) {
        throw new Error(
          `Expected ${numAgents} questions, got ${questions.length}`
        );
      }

      return questions;
    } catch {
      // Fallback: create simple variations if AI fails
      return [
        `Research comprehensive information about: ${userInput}`,
        `Analyze and provide insights about: ${userInput}`,
        `Find alternative perspectives on: ${userInput}`,
        `Verify and cross-check facts about: ${userInput}`,
      ].slice(0, numAgents);
    }
  }

  updateAgentProgress(agentId: number, status: string, result?: string): void {
    this.agentProgress.set(agentId, status);
    if (result !== undefined) {
      this.agentResults.set(agentId, result);
    }
  }

  async runAgentParallel(
    agentId: number,
    subtask: string
  ): Promise<AgentResult> {
    try {
      this.updateAgentProgress(agentId, 'PROCESSING...');

      // Use simple agent like in main.py
      const agent = new OpenRouterAgent(this.config, true);

      const startTime = Date.now();
      const response = await agent.run(subtask);
      const executionTime = Date.now() - startTime;

      this.updateAgentProgress(agentId, 'COMPLETED', response);

      return {
        agent_id: agentId,
        status: 'success',
        response,
        execution_time: executionTime,
      };
    } catch (error) {
      return {
        agent_id: agentId,
        status: 'error',
        response: `Error: ${error}`,
        execution_time: 0,
      };
    }
  }

  async aggregateResults(agentResults: AgentResult[]): Promise<string> {
    const successfulResults = agentResults.filter(
      (r) => r.status === 'success'
    );

    if (successfulResults.length === 0) {
      return 'All agents failed to provide results. Please try again.';
    }

    // Extract responses for aggregation
    const responses = successfulResults.map((r) => r.response);

    if (this.aggregationStrategy === 'consensus') {
      return await this.aggregateConsensus(responses);
    } else {
      // Default to consensus
      return await this.aggregateConsensus(responses);
    }
  }

  private async aggregateConsensus(responses: string[]): Promise<string> {
    if (responses.length === 1) {
      return responses[0];
    }

    // Create synthesis agent to combine all responses
    const synthesisAgent = new OpenRouterAgent(this.config, true);

    // Build agent responses section
    let agentResponsesText = '';
    for (let i = 0; i < responses.length; i++) {
      agentResponsesText += `=== AGENT ${i + 1} RESPONSE ===\n${responses[i]}\n\n`;
    }

    // Get synthesis prompt from config and format it
    const synthesisPromptTemplate = this.config.orchestrator.synthesis_prompt;
    const synthesisPrompt = synthesisPromptTemplate
      .replace('{num_responses}', responses.length.toString())
      .replace('{agent_responses}', agentResponsesText);

    // Completely remove all tools from synthesis agent to force direct response
    synthesisAgent.tools = [];
    synthesisAgent.toolMapping.clear();

    // Get the synthesized response
    try {
      const finalAnswer = await synthesisAgent.run(synthesisPrompt);
      return finalAnswer;
    } catch (error) {
      // Log the error for debugging
      console.log(`\n🚨 SYNTHESIS FAILED: ${error}`);
      console.log('📋 Falling back to concatenated responses\n');
      // Fallback: if synthesis fails, concatenate responses
      const combined = [];
      for (let i = 0; i < responses.length; i++) {
        combined.push(`=== Agent ${i + 1} Response ===`);
        combined.push(responses[i]);
        combined.push('');
      }
      return combined.join('\n');
    }
  }

  getProgressStatus(): Map<number, string> {
    return new Map(this.agentProgress);
  }

  async orchestrate(userInput: string): Promise<string> {
    // Reset progress tracking
    this.agentProgress.clear();
    this.agentResults.clear();

    // Decompose task into subtasks
    const subtasks = await this.decomposeTask(userInput, this.numAgents);

    // Initialize progress tracking
    for (let i = 0; i < this.numAgents; i++) {
      this.agentProgress.set(i, 'QUEUED');
    }

    // Execute agents in parallel
    const agentPromises = subtasks.map((subtask, i) =>
      this.runAgentParallel(i, subtask)
    );

    // Wait for all agents to complete with timeout
    const agentResults = await Promise.allSettled(agentPromises.map((p) => p));

    const results: AgentResult[] = agentResults.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          agent_id: i,
          status: 'timeout',
          response: `Agent ${i + 1} timed out or failed: ${result.reason}`,
          execution_time: this.taskTimeout,
        };
      }
    });

    // Sort results by agent_id for consistent output
    results.sort((a, b) => a.agent_id - b.agent_id);

    // Aggregate results
    const finalResult = await this.aggregateResults(results);

    return finalResult;
  }
}
