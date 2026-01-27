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

# Function to create symlink for files
link_file() {
    local source="$1"
    local target="$2"

    # Check if source file exists
    if [ ! -f "$source" ]; then
        log_warning "$(basename "$source") が見つかりません: $source"
        return 0
    fi

    # Check if already correctly linked
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
        log_success "$(basename "$target") は既にリンクされています"
        return 0
    fi

    # Error if target exists but is not the correct symlink
    if [ -e "$target" ]; then
        log_error "$(basename "$target") が既に存在します。手動で削除してください: $target"
        return 1
    fi

    # Create parent directory if needed
    local target_dir="$(dirname "$target")"
    if [ ! -d "$target_dir" ]; then
        mkdir -p "$target_dir"
        log_info "ディレクトリを作成しました: $target_dir"
    fi

    # Create symlink
    if ln -sf "$source" "$target"; then
        log_success "$(basename "$target") をリンクしました: $target -> $source"
    else
        log_error "$(basename "$target") のリンクに失敗しました"
        return 1
    fi
}

# Function to create symlink for directories
link_directory() {
    local source="$1"
    local target="$2"

    # Check if source directory exists
    if [ ! -d "$source" ]; then
        log_warning "$(basename "$source") ディレクトリが見つかりません: $source"
        return 0
    fi

    # Check if already correctly linked
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
        log_success "$(basename "$target") は既にリンクされています"
        return 0
    fi

    # Error if target exists but is not the correct symlink
    if [ -e "$target" ]; then
        log_error "$(basename "$target") が既に存在します。手動で削除してください: $target"
        return 1
    fi

    # Create parent directory if needed
    local target_dir="$(dirname "$target")"
    if [ ! -d "$target_dir" ]; then
        mkdir -p "$target_dir"
        log_info "ディレクトリを作成しました: $target_dir"
    fi

    # Create symlink
    if ln -sf "$source" "$target"; then
        log_success "$(basename "$target") をリンクしました: $target -> $source"
    else
        log_error "$(basename "$target") のリンクに失敗しました"
        return 1
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
    link_file "$DOTFILES_DIR/$file" "$HOME/$file"
done

# SSH config
log_info "SSH設定をリンクしています..."
link_file "$DOTFILES_DIR/config/ssh/config" "$HOME/.ssh/config"

# Starship config (environment variable based, but create backup symlink)
log_info "Starship設定を確認しています..."
link_file "$DOTFILES_DIR/config/starship.toml" "$HOME/.config/starship.toml"
log_info "注意: .zshrcでSTARSHIP_CONFIG環境変数も設定されています"

# Claude commands
log_info "Claude commandsを設定しています..."
link_directory "$DOTFILES_DIR/claude-code/commands" "$HOME/.claude/commands"

# Claude Agents
log_info "Claude Agentを設定しています..."
link_directory "$DOTFILES_DIR/claude-code/agents" "$HOME/.claude/agents"

# Claude Skills
log_info "Claude Skillsを設定しています..."
link_directory "$DOTFILES_DIR/claude-code/skills" "$HOME/.claude/skills"

# Claude Memory
log_info "Claude Memory(CLAUDE.md)を設定しています..."
link_file "$DOTFILES_DIR/claude-code/CLAUDE.md" "$HOME/.claude/CLAUDE.md"

# Gemini Commands
log_info "Gemini Commandsを設定しています..."
link_directory "$DOTFILES_DIR/gemini-cli/commands" "$HOME/.gemini/commands"

# Codex AGENTS.md
log_info "Codex AGENTS.mdを設定しています..."
link_file "$DOTFILES_DIR/codex/AGENTS.md" "$HOME/.codex/AGENTS.md"

# Sync Skills (Codex)
log_info "Codex Skillsを設定しています..."
link_directory "$DOTFILES_DIR/claude-code/skills" "$HOME/.codex/skills"

# Sync Skills (Copilot)
log_info "Copilot Skillsを設定しています..."
link_directory "$DOTFILES_DIR/claude-code/skills" "$HOME/.github/skills"

# Final message
log_success "=== セットアップが完了しました! ==="
log_info "新しいターミナルセッションを開始するか、以下のコマンドを実行してください:"
log_info "  source ~/.zshrc"
echo
log_info "トラブルシューティング:"
log_info "  - 既存ファイル/ディレクトリがある場合は手動で削除してから再実行してください"
log_info "  - .localrcファイルに端末固有の設定を追加してください"
echo
