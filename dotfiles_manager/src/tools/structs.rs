pub struct Tool {
    pub name: &'static str,
    pub setup_commands: SetupCommands,
}

pub struct SetupCommands {
    pub mac: Option<&'static str>,
    pub debian: Option<&'static str>,
    pub windows: Option<&'static str>,
}
