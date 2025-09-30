import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReadFileTool } from './read-file-tool';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  const mockConfig = {};

  beforeEach(() => {
    tool = new ReadFileTool(mockConfig);
    vi.clearAllMocks();
  });

  it('should read entire file successfully', () => {
    const filePath = '/test/file.txt';
    const fileContent = 'This is the file content';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

    const result = tool.execute(filePath);

    expect(result).toEqual({
      path: filePath,
      content: fileContent,
      success: true,
    });
    expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
  });

  it('should return error if file does not exist', () => {
    const filePath = '/test/nonexistent.txt';

    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = tool.execute(filePath);

    expect(result).toEqual({
      error: `File not found: ${filePath}`,
    });
    expect(fs.statSync).not.toHaveBeenCalled();
  });

  it('should return error if path is not a file', () => {
    const filePath = '/test/directory';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as any);

    const result = tool.execute(filePath);

    expect(result).toEqual({
      error: `Path is not a file: ${filePath}`,
    });
  });

  it('should return error if both head and tail are specified', () => {
    const result = tool.execute('/test/file.txt', 5, 5);

    expect(result).toEqual({
      error: 'Cannot specify both head and tail parameters',
    });
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it('should read first N lines with head parameter', () => {
    const filePath = '/test/file.txt';
    const fileContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    const expectedContent = 'Line 1\nLine 2\nLine 3';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

    const result = tool.execute(filePath, 3);

    expect(result).toEqual({
      path: filePath,
      content: expectedContent,
      success: true,
    });
  });

  it('should read last N lines with tail parameter', () => {
    const filePath = '/test/file.txt';
    const fileContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    const expectedContent = 'Line 3\nLine 4\nLine 5';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockReturnValue(fileContent);

    const result = tool.execute(filePath, undefined, 3);

    expect(result).toEqual({
      path: filePath,
      content: expectedContent,
      success: true,
    });
  });

  it('should handle read error gracefully', () => {
    const filePath = '/test/file.txt';

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = tool.execute(filePath);

    expect(result).toEqual({
      error: 'Failed to read file: Permission denied',
    });
  });
});
