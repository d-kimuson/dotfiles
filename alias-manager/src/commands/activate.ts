import { getAliases, getFunctions } from '../config/commands.js';
import { toCommandFromAlias, toCommandFromFunction } from './types.js';

export function displayActivateAliasesAndFunctions(): string {
  return [
    ...getAliases().map(toCommandFromAlias).map(({ definition }) => definition),
    ...getFunctions().map(toCommandFromFunction).map(({ definition }) => definition)
  ].join('\n');
} 