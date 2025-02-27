import { getAliases, getFunctions } from '../config/commands.js';
import { toCommandFromAlias, toCommandFromFunction } from './types.js';

export function displayActivateAliasesAndFunctions(): string {
  const aliases = getAliases().map(toCommandFromAlias);
  const functions = getFunctions().map(toCommandFromFunction);
  
  const output: string[] = [];
  
  for (const command of aliases) {
    output.push(command.definition);
  }
  
  for (const command of functions) {
    output.push(command.definition);
  }
  
  return output.join('\n');
} 