import { Tool } from '../tools/types.js';

export function getToolConfigs(): Tool[] {
  return [
    {
      name: 'mise',
      setupCommands: {
        mac: 'brew install mise',
      },
    },
    {
      name: 'direnv',
      setupCommands: {},
    },
    {
      name: 'git',
      setupCommands: {
        mac: 'brew install git && brew link --overwrite git',
      },
    },
    {
      name: 'starship',
      setupCommands: {
        mac: 'curl -sS https://starship.rs/install.sh | sh',
        debian: 'curl -sS https://starship.rs/install.sh | sh',
      },
    },
    {
      name: 'colordiff',
      setupCommands: {
        mac: 'brew install colordiff',
      },
    },
    {
      name: 'fd',
      setupCommands: {
        mac: 'brew install fd',
        debian: 'sudo apt install -y fd-find',
      },
    },
    {
      name: 'lsd',
      setupCommands: {
        mac: 'brew install lsd',
        debian: 'sudo apt install -y lsd',
      },
    },
    {
      name: 'exa',
      setupCommands: {
        mac: 'brew install exa',
        debian: 'sudo apt install -y exa',
      },
    },
    {
      name: 'bat',
      setupCommands: {
        mac: 'brew install bat',
        debian: 'sudo apt install -y bat',
      },
    },
  ];
} 