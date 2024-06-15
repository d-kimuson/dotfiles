pub struct Command {
    pub name: String,
    pub definition: String,
}

#[derive(Clone)]
pub struct FunctionDeclaration {
    pub name: &'static str,
    pub definition: &'static str,
}

#[derive(Clone)]
pub struct AliasDeclaration {
    pub name: &'static str,
    pub definition: &'static str,
}

pub trait ToCommand {
    fn to_command(&self) -> Command;
}

impl ToCommand for AliasDeclaration {
    fn to_command(&self) -> Command {
        Command {
            name: self.name.to_string(),
            definition: format!("alias {}=\"{}\";", self.name, self.definition),
        }
    }
}

impl ToCommand for FunctionDeclaration {
    fn to_command(&self) -> Command {
        let command_name = self.name;
        let cleaned_definition = self
            .definition
            .lines()
            .map(|line| "    ".to_string() + line.trim())
            .filter(|line| !line.ends_with(" "))
            .collect::<Vec<String>>()
            .join("\n");

        Command {
            name: command_name.to_string(),
            definition: format!("function {command_name}() {{\n{cleaned_definition}\n}}"),
        }
    }
}
