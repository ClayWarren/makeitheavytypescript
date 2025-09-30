import { BaseTool } from './base-tool';
import { CalculatorTool } from './calculator-tool';
import { ReadFileTool } from './read-file-tool';
import { SearchTool } from './search-tool';
import { TaskDoneTool } from './task-done-tool';
import { WriteFileTool } from './write-file-tool';

export function discoverTools(
  config: Record<string, unknown>,
  silent: boolean = false
): Map<string, BaseTool> {
  const tools = new Map<string, BaseTool>();

  // List of tool classes to instantiate
  const toolClasses = [
    CalculatorTool,
    ReadFileTool,
    SearchTool,
    TaskDoneTool,
    WriteFileTool,
  ];

  for (const ToolClass of toolClasses) {
    try {
      const toolInstance = new ToolClass(config);
      tools.set(toolInstance.name, toolInstance);
      if (!silent) {
        console.log(`Loaded tool: ${toolInstance.name}`);
      }
    } catch (error) {
      if (!silent) {
        console.log(`Warning: Could not load tool ${ToolClass.name}: ${error}`);
      }
    }
  }

  return tools;
}
