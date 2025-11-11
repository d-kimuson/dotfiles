---
name: shadcn-ui
description: Guidelines for shadcn-ui. Use when working with shadcn-ui components.
---

<fundamental_concept>
## What is shadcn-ui?

shadcn-ui is **NOT an npm package**. It's a **code distribution platform** that copies component source code directly into your project.

**Key principle**: Components are added via CLI (`pnpx shadcn@latest add`) from a remote registry, NOT installed as dependencies.
</fundamental_concept>

<component_management>
## Adding Components

<cli_usage>
### Primary Method: CLI

```bash
# Add single component
pnpx shadcn@latest add button

# Add multiple components
pnpx shadcn@latest add button card dialog

# Add all components
pnpx shadcn@latest add --all

# Preview component before adding
pnpx shadcn@latest view button
```

**Important**: Always use the CLI to add components. Do NOT create component files manually in `components/ui/` unless explicitly instructed.
</cli_usage>

<catalog_discovery>
### Finding Components

1. **Official catalog**: Browse components at https://ui.shadcn.com/docs/components
2. **CLI preview**: Use `pnpx shadcn@latest view <component-name>` to preview before adding
3. **Search**: Check the documentation site for all 60+ available components organized by category:
   - Form & Input (16 components)
   - Layout & Navigation (8 components)
   - Overlays & Dialogs (11 components)
   - Feedback & Status (7 components)
   - Display & Media (10 components)
</catalog_discovery>

<custom_registries>
### Custom Registries (if configured)

```bash
# Add from namespaced registry
pnpx shadcn@latest add @v0/dashboard

# Add from URL
pnpx shadcn@latest add https://example.com/r/custom-component.json
```

Registry configuration is in `components.json`:
```json
{
  "registries": {
    "@acme": "https://registry.acme.com/r/{name}.json"
  }
}
```
</custom_registries>
</component_management>

<critical_constraints>
## DO NOT Edit Generated Files

**NEVER directly edit files in these directories without explicit user instruction**:
- `components/ui/` - CLI-generated component files
- Any directory specified in `components.json` aliases

**Why?**: These files are managed by the CLI. Direct edits will be lost on updates.

<modification_workflow>
### When Component Behavior Needs Customization

**Step 1: Try usage-side control first**
```tsx
// ✅ Best: Control via props/className/composition at usage site
<Button className="custom-styling" onClick={customHandler} />
```

**Step 2: If usage-side control is insufficient**
You MUST ask the user for permission before modifying `components/ui/` files.

**Required information for user approval**:
1. **Why extension is needed**: Explain what cannot be achieved via props/className
2. **Design approach**: Describe how you plan to extend the component (new props, variant, internal logic change, etc.)

**Example request**:
> The Button component needs to support an `icon` prop for consistent icon positioning. This cannot be achieved via className alone because it requires conditional rendering logic. I propose adding an optional `icon?: React.ReactNode` prop and rendering it with fixed spacing before children. May I modify `components/ui/button.tsx`?

Only proceed with modification after receiving explicit user approval.
</modification_workflow>
</critical_constraints>

<common_tasks>
## Common Tasks

- **Initial setup**: See https://ui.shadcn.com/docs/installation
- **Theming/Dark mode**: See https://ui.shadcn.com/docs/dark-mode
- **Form integration**: See https://ui.shadcn.com/docs/components/form
- **Custom components**: See https://ui.shadcn.com/docs/components-json
- **Monorepo setup**: See https://ui.shadcn.com/docs/monorepo

For comprehensive reference when documentation is insufficient, consult: https://ui.shadcn.com/llms.txt
</common_tasks>

<architecture_notes>
## Technical Details

- **Built with**: TypeScript, Tailwind CSS, Radix UI primitives
- **Configuration**: `components.json` at project root
- **Customization**: Components are yours to own - they're copied into your codebase
- **Updates**: Re-run `pnpx shadcn@latest add <component> --overwrite` to update

**Remember**: shadcn-ui provides the code, not the package. You maintain full control and ownership.
</architecture_notes>
