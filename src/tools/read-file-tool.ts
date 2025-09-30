import { BaseTool, ToolResult, ToolParameters } from './base-tool';
import * as fs from 'fs';

export class ReadFileTool extends BaseTool {
  constructor(private config: Record<string, unknown>) {
    super();
  }

  get name(): string {
    return 'read_file';
  }

  get description(): string {
    return 'Read the complete contents of a file from the file system. Handles various text encodings and provides detailed error messages if the file cannot be read.';
  }

  get parameters(): ToolParameters {
    return {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read',
        },
        head: {
          type: 'integer',
          description:
            'If provided, returns only the first N lines of the file',
        },
        tail: {
          type: 'integer',
          description: 'If provided, returns only the last N lines of the file',
        },
      },
      required: ['path'],
    };
  }

  execute(path: string, head?: number, tail?: number): ToolResult {
    try {
      // Validate parameters
      if (head !== undefined && tail !== undefined) {
        return { error: 'Cannot specify both head and tail parameters' };
      }

      // Check if file exists
      if (!fs.existsSync(path)) {
        return { error: `File not found: ${path}` };
      }

      // Check if it's actually a file (not a directory)
      const stats = fs.statSync(path);
      if (!stats.isFile()) {
        return { error: `Path is not a file: ${path}` };
      }

      // Read file with appropriate method
      if (head !== undefined) {
        // Read first N lines
        const content = fs.readFileSync(path, 'utf-8');
        const lines = content.split('\n').slice(0, head);
        const resultContent = lines.join('\n').replace(/\n$/, '');
        return {
          path,
          content: resultContent,
          success: true,
        };
      } else if (tail !== undefined) {
        // Read last N lines
        const content = fs.readFileSync(path, 'utf-8');
        const lines = content.split('\n');
        const resultLines = lines.slice(-tail);
        const resultContent = resultLines.join('\n').replace(/\n$/, '');
        return {
          path,
          content: resultContent,
          success: true,
        };
      } else {
        // Read entire file
        const content = fs.readFileSync(path, 'utf-8');
        return {
          path,
          content,
          success: true,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to read file: ${error.message}` };
      }
      return { error: 'Failed to read file' };
    }
  }
}
