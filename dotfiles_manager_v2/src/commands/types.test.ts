import { describe, it, expect } from 'vitest';
import { toCommandFromAlias, toCommandFromFunction } from './types.js';
import type { AliasDeclaration, FunctionDeclaration } from './types.js';

describe('toCommandFromAlias', () => {
  it('should convert an alias declaration to a command', () => {
    const alias: AliasDeclaration = {
      name: 'test',
      definition: 'echo test',
    };
    
    const command = toCommandFromAlias(alias);
    
    expect(command.name).toBe('test');
    expect(command.definition).toBe('alias test="echo test";');
  });
});

describe('toCommandFromFunction', () => {
  it('should convert a function declaration to a command', () => {
    const func: FunctionDeclaration = {
      name: 'test_func',
      definition: `
echo "test function"
return 0
`,
    };
    
    const command = toCommandFromFunction(func);
    
    expect(command.name).toBe('test_func');
    expect(command.definition).toContain('function test_func() {');
    expect(command.definition).toContain('echo "test function"');
    expect(command.definition).toContain('return 0');
    expect(command.definition).toContain('}');
  });
  
  it('should clean up the function definition', () => {
    const func: FunctionDeclaration = {
      name: 'test_func',
      definition: `
  echo "test function"
  echo "with indentation"
  return 0 
`,
    };
    
    const command = toCommandFromFunction(func);
    
    expect(command.definition).toContain('    echo "test function"');
    expect(command.definition).toContain('    echo "with indentation"');
    expect(command.definition).toContain('    return 0');
    expect(command.definition).not.toContain('return 0 '); // Trailing space should be removed
  });
}); 