import { BaseTool, ToolResult, ToolParameters } from './base-tool';
import * as fs from 'fs';
import * as path from 'path';

export class WriteFileTool extends BaseTool {
  constructor(private config: Record<string, unknown>) {
    super();
  }

  get name(): string {
    return 'write_file';
  }

  get description(): string {
    return 'Create a new file or completely overwrite an existing file with new content. Use with caution as it will overwrite existing files without warning.';
  }

  get parameters(): ToolParameters {
    return {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to write to',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['path', 'content'],
    };
  }

  execute(filePath: string, content: string): ToolResult {
    try {
      // Get absolute path
      const absPath = path.resolve(filePath);

      // Create parent directories if needed
      const parentDir = path.dirname(absPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Write file atomically using temporary file
      const tempPath = absPath + '.tmp';
      try {
        fs.writeFileSync(tempPath, content, 'utf-8');

        // Atomic rename
        fs.renameSync(tempPath, absPath);

        return {
          path: absPath,
          bytes_written: Buffer.byteLength(content, 'utf-8'),
          success: true,
          message: `Successfully wrote to ${filePath}`,
        };
      } catch (error) {
        // Clean up temp file if it exists
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to write file: ${error.message}` };
      }
      return { error: 'Failed to write file' };
    }
  }
}
