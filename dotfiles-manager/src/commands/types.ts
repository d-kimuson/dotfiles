export interface Command {
  name: string;
  definition: string;
}

export interface FunctionDeclaration {
  name: string;
  definition: string;
}

export interface AliasDeclaration {
  name: string;
  definition: string;
}

export function toCommandFromAlias(alias: AliasDeclaration): Command {
  return {
    name: alias.name,
    definition: `alias ${alias.name}="${alias.definition}";`,
  };
}

export function toCommandFromFunction(func: FunctionDeclaration): Command {
  const commandName = func.name;
  const cleanedDefinition = func.definition
    .split('\n')
    .map(line => `    ${line.trim()}`)
    .filter(line => !line.endsWith(' '))
    .join('\n');

  return {
    name: commandName,
    definition: `function ${commandName}() {\n${cleanedDefinition}\n}`,
  };
} 