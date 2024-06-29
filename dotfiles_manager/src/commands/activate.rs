use crate::config::command::{get_aliases, get_functions};

use super::structs::{Command, ToCommand};

pub fn display_activate_aliases_and_functions() {
    let aliases = get_aliases()
        .iter()
        .map(|declare| declare.to_command())
        .collect::<Vec<Command>>();

    let functions = get_functions()
        .iter()
        .map(|declare| declare.to_command())
        .collect::<Vec<Command>>();

    for command in aliases {
        println!("{}", command.definition);
    }

    for command in functions {
        println!("{}", command.definition);
    }
}
