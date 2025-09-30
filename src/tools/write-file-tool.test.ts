import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WriteFileTool } from './write-file-tool';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path modules
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('path', () => ({
  resolve: vi.fn(),
  dirname: vi.fn(),
}));

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  const mockConfig = {};

  beforeEach(() => {
    tool = new WriteFileTool(mockConfig);
    vi.clearAllMocks();
  });

  it('should write file successfully', () => {
    const filePath = '/test/file.txt';
    const content = 'Hello, world!';
    const absPath = '/absolute/test/file.txt';
    const tempPath = '/absolute/test/file.txt.tmp';
    const parentDir = '/absolute/test';

    vi.mocked(path.resolve).mockReturnValue(absPath);
    vi.mocked(path.dirname).mockReturnValue(parentDir);
    vi.mocked(fs.existsSync).mockReturnValue(true); // Parent dir exists
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.renameSync).mockImplementation(() => {});

    const result = tool.execute(filePath, content);

    expect(result).toEqual({
      path: absPath,
      bytes_written: Buffer.byteLength(content, 'utf-8'),
      success: true,
      message: `Successfully wrote to ${filePath}`,
    });
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(tempPath, content, 'utf-8');
    expect(fs.renameSync).toHaveBeenCalledWith(tempPath, absPath);
  });

  it('should create parent directories if they do not exist', () => {
    const filePath = '/test/newdir/file.txt';
    const content = 'New file content';
    const absPath = '/absolute/test/newdir/file.txt';
    const tempPath = '/absolute/test/newdir/file.txt.tmp';
    const parentDir = '/absolute/test/newdir';

    vi.mocked(path.resolve).mockReturnValue(absPath);
    vi.mocked(path.dirname).mockReturnValue(parentDir);
    vi.mocked(fs.existsSync).mockReturnValue(false); // Parent dir does not exist
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.renameSync).mockImplementation(() => {});

    const result = tool.execute(filePath, content);

    expect(result.success).toBe(true);
    expect(fs.mkdirSync).toHaveBeenCalledWith(parentDir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(tempPath, content, 'utf-8');
    expect(fs.renameSync).toHaveBeenCalledWith(tempPath, absPath);
  });

  it('should handle write error and clean up temp file', () => {
    const filePath = '/test/file.txt';
    const content = 'Content';
    const absPath = '/absolute/test/file.txt';
    const tempPath = '/absolute/test/file.txt.tmp';
    const parentDir = '/absolute/test';

    vi.mocked(path.resolve).mockReturnValue(absPath);
    vi.mocked(path.dirname).mockReturnValue(parentDir);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('Disk full');
    });
    vi.mocked(fs.existsSync).mockReturnValue(true); // Temp file exists for cleanup

    const result = tool.execute(filePath, content);

    expect(result).toEqual({
      error: 'Failed to write file: Disk full',
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith(tempPath);
  });

  it('should handle general error', () => {
    const filePath = '/test/file.txt';
    const content = 'Content';

    vi.mocked(path.resolve).mockImplementation(() => {
      throw new Error('Invalid path');
    });

    const result = tool.execute(filePath, content);

    expect(result).toEqual({
      error: 'Failed to write file: Invalid path',
    });
  });

  it('should calculate correct bytes written', () => {
    const filePath = '/test/file.txt';
    const content = 'Hello, 世界!'; // Multi-byte characters
    const absPath = '/absolute/test/file.txt';
    const parentDir = '/absolute/test';

    vi.mocked(path.resolve).mockReturnValue(absPath);
    vi.mocked(path.dirname).mockReturnValue(parentDir);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.renameSync).mockImplementation(() => {});

    const result = tool.execute(filePath, content);

    expect(result.bytes_written).toBe(Buffer.byteLength(content, 'utf-8'));
  });
});
