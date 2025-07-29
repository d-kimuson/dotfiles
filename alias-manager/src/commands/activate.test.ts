import { describe, it, expect, vi } from 'vitest';
import { displayActivateAliasesAndFunctions } from './activate.js';
import * as commandsConfig from '../config/commands.js';

describe('activate', () => {
  it('should generate shell script with aliases and functions', () => {
    // Mock the config functions
    vi.spyOn(commandsConfig, 'getAliases').mockReturnValue([
      { name: 'test', definition: 'echo test' },
    ]);
    
    vi.spyOn(commandsConfig, 'getFunctions').mockReturnValue([
      { 
        name: 'test_func', 
        definition: `
  echo "test function"
  return 0
` 
      },
    ]);

    const result = displayActivateAliasesAndFunctions();
    
    // Check that the output contains the expected alias
    expect(result).toContain('alias test="echo test";');
    
    // Check that the output contains the expected function
    expect(result).toContain('function test_func() {');
    expect(result).toContain('echo "test function"');
    expect(result).toContain('return 0');
  });
}); 