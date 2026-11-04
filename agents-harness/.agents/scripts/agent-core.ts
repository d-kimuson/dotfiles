#!/usr/bin/env node

import { run } from './agent-core/cli.ts'

process.exitCode = await run(process.argv.slice(2))
