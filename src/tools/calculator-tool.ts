import { BaseTool, ToolResult, ToolParameters } from './base-tool';
import * as math from 'mathjs';

export class CalculatorTool extends BaseTool {
  constructor(private config: Record<string, unknown>) {
    super();
  }

  get name(): string {
    return 'calculate';
  }

  get description(): string {
    return 'Perform mathematical calculations and evaluations';
  }

  get parameters(): ToolParameters {
    return {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description:
            "Mathematical expression to evaluate (e.g., '2 + 3 * 4', 'sqrt(16)', 'sin(pi/2)')",
        },
      },
      required: ['expression'],
    };
  }

  execute(expression: string): ToolResult {
    try {
      // Use mathjs for safe evaluation
      const result = math.evaluate(expression);
      return {
        expression,
        result,
        success: true,
      };
    } catch (error) {
      return {
        expression,
        error: (error as Error).message,
        success: false,
      };
    }
  }
}
