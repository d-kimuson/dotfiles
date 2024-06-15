use std::fs;
use std::os::unix::fs::symlink;
use std::path::PathBuf;

fn get_sync_files() -> Vec<&'static str> {
    vec![
        ".zshrc",
        ".localrc",
        ".gitconfig",
        ".gitconfig-local",
        ".gitconfig-sms",
        ".gitignore_global",
        ".czrc",
    ]
}

pub fn link_files() {
    for item in get_sync_files() {
        let home_dir = dirs::home_dir().expect("Failed to get home directory");
        let target_path: PathBuf = home_dir.join(item);
        let source_path: PathBuf = home_dir.join("dotfiles").join(item);

        if target_path.exists() {
            println!("{} is already exists, so skipped.", target_path.display());
        } else {
            if let Err(e) = symlink(&source_path, &target_path) {
                eprintln!("Failed to create symlink for {}: {}", item, e);
            } else {
                println!("{} is linked.", target_path.display());
            }
        }
    }
}

pub fn unlink_files() {
    for item in get_sync_files() {
        let home_dir = dirs::home_dir().expect("Failed to get home directory");
        let target_path: PathBuf = home_dir.join(item);

        if !(target_path.exists()) {
            println!("{} does not exist, so skipped.", target_path.display());
            return;
        }

        if !(target_path
            .symlink_metadata()
            .unwrap()
            .file_type()
            .is_symlink())
        {
            println!(
                "{} exists, but it's not a link so skipped.",
                target_path.display()
            );
            return;
        }

        if let Err(e) = fs::remove_file(&target_path) {
            eprintln!("Failed to unlink {}: {}", item, e);
        } else {
            println!("{} is unlinked.", target_path.display());
        }
    }
}
