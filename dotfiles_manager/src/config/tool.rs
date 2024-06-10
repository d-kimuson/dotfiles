use crate::tools::structs::{SetupCommands, Tool};

pub fn get_tool_configs() -> Vec<Tool> {
    vec![Tool {
        name: "mise",
        setup_commands: SetupCommands {
            mac: Some("brew install mise"),
            debian: None,
            windows: None,
        },
    }]
}
