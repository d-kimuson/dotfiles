import { execSync } from 'child_process';
import os from 'os';
import { getToolConfigs } from '../config/tools.js';

export function setupTools(): void {
  const platform = os.platform();
  
  for (const tool of getToolConfigs()) {
    let command: string | undefined;
    
    if (platform === 'darwin') {
      command = tool.setupCommands.mac;
    } else if (platform === 'linux') {
      command = tool.setupCommands.debian;
    } else if (platform === 'win32') {
      command = tool.setupCommands.windows;
    }

    if (!command) {
      console.log(`No setup command found for ${tool.name}`);
      continue;
    }

    console.log(`Setting up ${tool.name}: ${command}`);
    try {
      execSync(command, { stdio: 'inherit', shell: '/bin/bash' });
    } catch (e) {
      console.error(`Failed to execute command: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('All tools have been set up!');
} 