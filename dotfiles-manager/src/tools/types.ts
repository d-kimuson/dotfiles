export interface SetupCommands {
  mac?: string;
  debian?: string;
  windows?: string;
}

export interface Tool {
  name: string;
  setupCommands: SetupCommands;
} 