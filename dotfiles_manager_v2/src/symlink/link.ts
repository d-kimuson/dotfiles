import fs from 'fs';
import path from 'path';
import os from 'os';

function getSyncFiles(): string[] {
  return [
    '.zshrc',
    '.localrc',
    '.gitconfig',
    '.gitconfig-local',
    '.gitconfig-sms',
    '.gitignore_global',
    '.czrc',
  ];
}

export function linkFiles(): void {
  for (const item of getSyncFiles()) {
    const homeDir = os.homedir();
    const targetPath = path.join(homeDir, item);
    const sourcePath = path.join(homeDir, 'dotfiles', item);

    if (fs.existsSync(targetPath)) {
      console.log(`${targetPath} already exists, so skipped.`);
    } else {
      try {
        fs.symlinkSync(sourcePath, targetPath);
        console.log(`${targetPath} is linked.`);
      } catch (e) {
        console.error(`Failed to create symlink for ${item}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}

export function unlinkFiles(): void {
  for (const item of getSyncFiles()) {
    const homeDir = os.homedir();
    const targetPath = path.join(homeDir, item);

    if (!fs.existsSync(targetPath)) {
      console.log(`${targetPath} does not exist, so skipped.`);
      continue;
    }

    try {
      const stats = fs.lstatSync(targetPath);
      if (!stats.isSymbolicLink()) {
        console.log(`${targetPath} exists, but it's not a link so skipped.`);
        continue;
      }

      fs.unlinkSync(targetPath);
      console.log(`${targetPath} is unlinked.`);
    } catch (e) {
      console.error(`Failed to unlink ${item}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
} 