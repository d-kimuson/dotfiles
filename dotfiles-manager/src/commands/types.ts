export interface Command {
  name: string;
  definition: string;
}

export interface FunctionDeclaration {
  name: string;
  definition: string;
}

export const fn = (name: string, definition: string): FunctionDeclaration => {
  return {
    name,
    definition: definition.slice(
      definition.startsWith('\n') ? 1 : 0,
      definition.endsWith('\n') ? -1 : undefined
    ),
  }
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
  return {
    name: func.name,
    definition: `function ${func.name}() {\n${func.definition}\n}`,
  };
} 