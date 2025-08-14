#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTFILES_DIR="$(dirname "$SCRIPT_DIR")"

log_info "Dotfiles directory: $DOTFILES_DIR"

# Function to create symlink with backup
create_symlink() {
    local source="$1"
    local target="$2"
    local description="$3"

    if [ -L "$target" ]; then
        if [ "$(readlink "$target")" = "$source" ]; then
            log_success "$description は既にリンクされています"
            return 0
        else
            log_warning "$description は異なるリンク先を指しています。バックアップして再リンクします"
            mv "$target" "${target}.backup.$(date +%Y%m%d_%H%M%S)"
        fi
    elif [ -e "$target" ]; then
        log_warning "$description が既に存在します。バックアップして再リンクします"
        mv "$target" "${target}.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    if ln -sf "$source" "$target"; then
        log_success "$description をリンクしました: $target -> $source"
    else
        log_error "$description のリンクに失敗しました"
        return 1
    fi
}

# Function to create directory if it doesn't exist
ensure_directory() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        log_info "ディレクトリを作成しました: $dir"
    fi
}

log_info "=== Dotfiles セットアップを開始します ==="

# Main dotfiles (from root directory)
log_info "メイン設定ファイルをリンクしています..."

declare -a main_files=(
    ".zshrc"
    ".localrc"
    ".gitconfig"
    ".gitconfig-local"
    ".gitconfig-sms"
    ".gitignore_global"
    ".czrc"
)

for file in "${main_files[@]}"; do
    source_path="$DOTFILES_DIR/$file"
    target_path="$HOME/$file"
    
    if [ -f "$source_path" ]; then
        create_symlink "$source_path" "$target_path" "$file"
    else
        log_warning "$file が見つかりません: $source_path"
    fi
done

# SSH config
log_info "SSH設定をリンクしています..."
ssh_dir="$HOME/.ssh"
ensure_directory "$ssh_dir"

ssh_config_source="$DOTFILES_DIR/config/ssh/config"
ssh_config_target="$HOME/.ssh/config"

if [ -f "$ssh_config_source" ]; then
    create_symlink "$ssh_config_source" "$ssh_config_target" "SSH設定"
else
    log_warning "SSH設定ファイルが見つかりません: $ssh_config_source"
fi

# Starship config (environment variable based, but create backup symlink)
log_info "Starship設定を確認しています..."
starship_source="$DOTFILES_DIR/config/starship.toml"
starship_target="$HOME/.config/starship.toml"

if [ -f "$starship_source" ]; then
    ensure_directory "$(dirname "$starship_target")"
    create_symlink "$starship_source" "$starship_target" "Starship設定"
    log_info "注意: .zshrcでSTARSHIP_CONFIG環境変数も設定されています"
else
    log_warning "Starship設定ファイルが見つかりません: $starship_source"
fi

# Claude commands
log_info "Claude commandsを設定しています..."
claude_dir="$HOME/.claude"
ensure_directory "$claude_dir"

claude_commands_source="$DOTFILES_DIR/claude-code/commands"
claude_commands_target="$HOME/.claude/commands"

if [ -d "$claude_commands_source" ]; then
    create_symlink "$claude_commands_source" "$claude_commands_target" "Claude commands"
else
    log_warning "Claude commandsディレクトリが見つかりません: $claude_commands_source"
fi

# Claude Agents
log_info "Claude Agentを設定しています..."
claude_commands_source="$DOTFILES_DIR/claude-code/agents"
claude_commands_target="$HOME/.claude/agents"

if [ -d "$claude_commands_source" ]; then
    create_symlink "$claude_commands_source" "$claude_commands_target" "Claude Agents"
else
    log_warning "Claude Agentsディレクトリが見つかりません: $claude_commands_source"
fi

# Claude Settings
log_info "Claude Settingsを設定しています..."
claude_settings_source="$DOTFILES_DIR/claude-code/settings.json"
claude_settings_target="$HOME/.claude/settings.json"

if [ -f "$claude_settings_source" ]; then
    create_symlink "$claude_settings_source" "$claude_settings_target" "Claude Settings"
else
    log_warning "Claude Settingsファイルが見つかりません: $claude_settings_source"
fi

# Claude Memory
log_info "Claude Memory(CLAUDE.md)を設定しています..."
claude_memory_source="$DOTFILES_DIR/claude-code/CLAUDE.md"
claude_memory_target="$HOME/.claude/CLAUDE.md"

if [ -f "$claude_memory_source" ]; then
    create_symlink "$claude_memory_source" "$claude_memory_target" "Claude Memory"
else
    log_warning "Claude Memoryファイルが見つかりません: $claude_memory_source"
fi

# Claude MCP
log_info "Claude MCPを設定しています..."
# 存在したらエラーになっちゃうが冪等にしたいので set +e して /dev/null に捨てる
set +e
~/.claude/local/claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest > /dev/null 2>&1
set -e

# Gemini Commands
log_info "Gemini Commandsを設定しています..."
gemini_commands_source="$DOTFILES_DIR/gemini-cli/commands"
gemini_commands_target="$HOME/.gemini/commands"

if [ -d "$gemini_commands_source" ]; then
    create_symlink "$gemini_commands_source" "$gemini_commands_target" "Gemini Commands"
    log_info "Gemini Commandsをコピーしました: $gemini_commands_source -> $gemini_commands_target"
else
    log_warning "Gemini Commandsディレクトリが見つかりません: $gemini_commands_source"
fi

# Final message
log_success "=== セットアップが完了しました! ==="
log_info "新しいターミナルセッションを開始するか、以下のコマンドを実行してください:"
log_info "  source ~/.zshrc"
echo
log_info "トラブルシューティング:"
log_info "  - バックアップファイルは *.backup.YYYYMMDD_HHMMSS 形式で作成されます"
log_info "  - .localrcファイルに端末固有の設定を追加してください"
echo
