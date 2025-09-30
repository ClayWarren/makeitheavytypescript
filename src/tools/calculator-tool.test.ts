import { describe, it, expect } from 'vitest';

import { CalculatorTool } from './calculator-tool';

describe('CalculatorTool', () => {
  it('should evaluate simple addition', () => {
    const tool = new CalculatorTool({});
    const result = tool.execute('2 + 2');
    expect(result).toEqual({
      expression: '2 + 2',
      result: 4,
      success: true,
    });
  });

  it('should handle errors for invalid expressions', () => {
    const tool = new CalculatorTool({});
    const result = tool.execute('invalid expression');
    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
  });

  it('should evaluate square root', () => {
    const tool = new CalculatorTool({});
    const result = tool.execute('sqrt(16)');
    expect(result).toEqual({
      expression: 'sqrt(16)',
      result: 4,
      success: true,
    });
  });
});
