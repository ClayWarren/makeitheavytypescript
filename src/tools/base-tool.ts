export interface ToolParameters {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
}

export interface ToolResult {
  [key: string]: unknown;
}

export abstract class BaseTool {
  abstract get name(): string;
  abstract get description(): string;
  abstract get parameters(): ToolParameters;

  abstract execute(...args: unknown[]): Promise<ToolResult> | ToolResult;

  toOpenRouterSchema(): Record<string, unknown> {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
