import { OpenAI } from 'openai';
import { discoverTools } from './tools';
import { BaseTool } from './tools/base-tool';
import { Config } from './config';

export class OpenRouterAgent {
  private client: OpenAI;
  private discoveredTools: Map<string, BaseTool>;
  public tools: Record<string, unknown>[];
  public toolMapping: Map<string, (args: unknown) => unknown>;

  constructor(
    private config: Config,
    private silent: boolean = false
  ) {
    // Initialize OpenAI client with OpenRouter
    this.client = new OpenAI({
      baseURL: config.openrouter.base_url,
      apiKey: config.openrouter.api_key,
    });

    // Discover tools dynamically
    this.discoveredTools = discoverTools(config, silent);

    // Build OpenRouter tools array
    this.tools = Array.from(this.discoveredTools.values()).map((tool) =>
      tool.toOpenRouterSchema()
    );

    // Build tool mapping
    this.toolMapping = new Map();
    for (const [name, tool] of this.discoveredTools) {
      this.toolMapping.set(name, tool.execute.bind(tool));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async callLLM(messages: any[]): Promise<any> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.openrouter.model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: this.tools as any,
      });
      return response;
    } catch (error) {
      throw new Error(`LLM call failed: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleToolCall(toolCall: any): Record<string, unknown> {
    try {
      // Extract tool name and arguments
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      // Call appropriate tool from tool_mapping
      if (this.toolMapping.has(toolName)) {
        const toolResult = this.toolMapping.get(toolName)!(toolArgs);
        return {
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult),
        };
      } else {
        return {
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
        };
      }
    } catch (error) {
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify({ error: `Tool execution failed: ${error}` }),
      };
    }
  }

  async run(userInput: string): Promise<string> {
    // Initialize messages with system prompt and user input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
      {
        role: 'system',
        content: this.config.system_prompt,
      },
      {
        role: 'user',
        content: userInput,
      },
    ];

    // Track all assistant responses for full content capture
    const fullResponseContent: string[] = [];

    // Implement agentic loop from OpenRouter docs
    const maxIterations = this.config.agent.max_iterations;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      if (!this.silent) {
        console.log(`🔄 Agent iteration ${iteration}/${maxIterations}`);
      }

      // Call LLM
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (await this.callLLM(messages)) as any;

      // Add the response to messages
      const assistantMessage = response.choices[0].message;
      messages.push({
        role: 'assistant',
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls,
      });

      // Capture assistant content for full response
      if (assistantMessage.content) {
        fullResponseContent.push(assistantMessage.content);
      }

      // Check if there are tool calls
      if (assistantMessage.tool_calls) {
        if (!this.silent) {
          console.log(
            `🔧 Agent making ${assistantMessage.tool_calls.length} tool call(s)`
          );
        }
        // Handle each tool call
        let taskCompleted = false;
        for (const toolCall of assistantMessage.tool_calls) {
          if (!this.silent) {
            console.log(`   📞 Calling tool: ${toolCall.function.name}`);
          }
          const toolResult = this.handleToolCall(toolCall);
          messages.push(toolResult);

          // Check if this was the task completion tool
          if (toolCall.function.name === 'mark_task_complete') {
            taskCompleted = true;
            if (!this.silent) {
              console.log('✅ Task completion tool called - exiting loop');
            }
            // Return FULL conversation content, not just completion message
            return fullResponseContent.join('\n\n');
          }
        }

        // If task was completed, we already returned above
        if (taskCompleted) {
          return fullResponseContent.join('\n\n');
        }
      } else {
        if (!this.silent) {
          console.log(
            '💭 Agent responded without tool calls - continuing loop'
          );
        }
      }

      // Continue the loop regardless of whether there were tool calls or not
    }

    // If max iterations reached, return whatever content we gathered
    return fullResponseContent.length > 0
      ? fullResponseContent.join('\n\n')
      : 'Maximum iterations reached. The agent may be stuck in a loop.';
  }
}
