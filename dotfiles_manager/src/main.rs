use std::process::exit;

use clap::Command;

use dotfiles_manager::{
    commands::activate::display_activate_aliases_and_functions, tools::setup_tools::setup_tools,
    update::update::update_to_latest,
};

fn main() {
    let matches = Command::new("dotfiles_manager")
        .version("1.0")
        .about("Manages command aliases")
        .subcommand(Command::new("activate").about(".zshrc aliases and functions"))
        .subcommand(Command::new("setup").about("Sets up the environment"))
        .subcommand(Command::new("update").about("update binary"))
        .get_matches();

    match matches.subcommand() {
        Some(("activate", _)) => {
            display_activate_aliases_and_functions();
        }
        Some(("setup", _)) => setup_tools(),
        Some(("update", _)) => update_to_latest(),
        _ => {
            eprintln!("No valid subcommand was provided. Use --help for more information.");
            exit(1)
        }
    }
}
