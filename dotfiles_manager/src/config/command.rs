use crate::commands::structs::{AliasDeclaration, FunctionDeclaration};

pub fn get_aliases() -> Vec<AliasDeclaration> {
    vec![
        AliasDeclaration {
            name: "gst",
            definition: "git status",
        },
        AliasDeclaration {
            name: "gco",
            definition: "git checkout",
        },
    ]
}

pub fn get_functions() -> Vec<FunctionDeclaration> {
    vec![FunctionDeclaration {
        name: "gcm",
        definition: r#"
        git checkout main
        git pull
        "#,
    }]
}
