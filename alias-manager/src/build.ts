import fs from 'fs';
import path from 'path';
import { displayActivateAliasesAndFunctions } from './commands/activate.js';

// 出力先ディレクトリを作成
const outputDir = path.join(process.cwd(), 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// シェルスクリプトを生成
const shellScript = displayActivateAliasesAndFunctions();

// シェルスクリプトをファイルに書き込む
const outputPath = path.join(outputDir, 'shell_aliases.sh');
fs.writeFileSync(outputPath, shellScript);

console.log(`シェルスクリプトを生成しました: ${outputPath}`);
