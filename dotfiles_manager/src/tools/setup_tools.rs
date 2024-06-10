use crate::config::tool::get_tool_configs;
use std::env;

pub fn setup_tools() {
    for tool in get_tool_configs() {
        let command = match env::consts::OS {
            "macos" => &tool.setup_commands.mac,
            "debian" => &tool.setup_commands.debian,
            "windows" => &tool.setup_commands.windows,
            _ => &None,
        };

        if command.is_none() {
            println!("No setup command found for {}", tool.name);
        } else {
            let unwrapped_command = command.as_ref().unwrap();
            println!("Setting up {}: {}", tool.name, unwrapped_command);
            std::process::Command::new("bash")
                .arg("-c")
                .arg(unwrapped_command)
                .status()
                .expect("Failed to execute command");
        }
    }

    println!("All tools have been set up!")
}
