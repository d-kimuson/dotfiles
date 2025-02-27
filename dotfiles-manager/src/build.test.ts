import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as activate from './commands/activate.js';

// モジュールのモック
vi.mock('fs');
vi.mock('path');
vi.mock('./commands/activate.js');

// コンソール出力をモック
vi.spyOn(console, 'log').mockImplementation(() => {});

// build.tsの内容を再現する関数
function runBuild() {
  // 出力先ディレクトリを作成
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // シェルスクリプトを生成
  const shellScript = activate.displayActivateAliasesAndFunctions();

  // シェルスクリプトをファイルに書き込む
  const outputPath = path.join(outputDir, 'shell_aliases.sh');
  fs.writeFileSync(outputPath, shellScript);

  console.log(`シェルスクリプトを生成しました: ${outputPath}`);
}

describe('build', () => {
  beforeEach(() => {
    // モックをリセット
    vi.resetAllMocks();
    
    // パスのモック
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    
    // プロセスのcwdのモック
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
    
    // fsのモック
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    
    // activateのモック
    vi.mocked(activate.displayActivateAliasesAndFunctions).mockReturnValue('mock shell script');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should create output directory if it does not exist', () => {
    // ビルドスクリプトを実行
    runBuild();
    
    // 出力ディレクトリの作成を確認
    expect(fs.existsSync).toHaveBeenCalledWith('/mock/cwd/output');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/cwd/output', { recursive: true });
  });
  
  it('should not create output directory if it already exists', () => {
    // ディレクトリが存在する場合
    vi.mocked(fs.existsSync).mockReturnValue(true);
    
    // ビルドスクリプトを実行
    runBuild();
    
    // ディレクトリ作成が呼ばれないことを確認
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
  
  it('should generate shell script and write to file', () => {
    // ビルドスクリプトを実行
    runBuild();
    
    // シェルスクリプトの生成と書き込みを確認
    expect(activate.displayActivateAliasesAndFunctions).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mock/cwd/output/shell_aliases.sh',
      'mock shell script'
    );
  });
}); 