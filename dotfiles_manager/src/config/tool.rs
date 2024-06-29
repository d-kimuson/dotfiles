use crate::tools::structs::{SetupCommands, Tool};

pub fn get_tool_configs() -> Vec<Tool> {
    vec![
        Tool {
            name: "mise",
            setup_commands: SetupCommands {
                mac: Some("brew install mise"),
                debian: None,
                windows: None,
            },
        },
        Tool {
            name: "direnv",
            setup_commands: SetupCommands {
                mac: None,
                debian: None,
                windows: None,
            },
        },
        Tool {
            name: "git",
            setup_commands: SetupCommands {
                mac: Some("brew install git && brew link --overwrite git"),
                debian: None,
                windows: None,
            },
        },
        Tool {
            name: "starship",
            setup_commands: SetupCommands {
                mac: Some("curl -sS https://starship.rs/install.sh | sh"),
                debian: Some("curl -sS https://starship.rs/install.sh | sh"),
                windows: None,
            },
        },
        Tool {
            name: "colordiff",
            setup_commands: SetupCommands {
                mac: Some("brew install colordiff"),
                debian: None,
                windows: None,
            },
        },
        Tool {
            name: "fd",
            setup_commands: SetupCommands {
                mac: Some("brew install fd"),
                debian: Some("sudo apt install -y fd-find"),
                windows: None,
            },
        },
        Tool {
            name: "lsd",
            setup_commands: SetupCommands {
                mac: Some("brew install lsd"),
                debian: Some("sudo apt install -y lsd"),
                windows: None,
            },
        },
        Tool {
            name: "exa",
            setup_commands: SetupCommands {
                mac: Some("brew install exa"),
                debian: Some("sudo apt install -y exa"),
                windows: None,
            },
        },
        Tool {
            name: "bat",
            setup_commands: SetupCommands {
                mac: Some("brew install bat"),
                debian: Some("sudo apt install -y bat"),
                windows: None,
            },
        },
    ]
}
