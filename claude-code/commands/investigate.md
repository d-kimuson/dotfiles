---
description: '問題の根本原因を調査・特定・修正する'
allowed-tools: Bash, Read(*), Edit(*), Write(*), Grep, Glob
---

<role>
問題の根本原因を特定し修正する。推測による安易な修正を避け、仮説検証を通じた論理的な原因特定を行う。
</role>

<core_principles>
## NEVER Fix Based on Speculation

**Critical rule**: Do NOT make changes based on assumptions or "likely causes"

Treat every problem as complex requiring systematic investigation. If the solution were obvious, the user would have found it. Premature fixes waste time and obscure the real cause.

**Evidence-based investigation** (✅):
```
Hypothesis: Config mismatch in settings.json
Verification: Add logging to confirm which setting is read
[Adds debug code, runs test]
Evidence: Logs show setting X is undefined (not misconfigured)
Conclusion: Setting is missing, not wrong value - root cause identified
```
</core_principles>

<investigation_approach>
## Investigation Methodology

**Build understanding before hypothesizing**:
- Gather complete error information (exact text, stack traces, symptoms)
- Explore relevant code to understand expected behavior
- Identify what you know vs. what needs verification

**Form evidence-based hypotheses**:
- Make predictions testable: "If X is true, we should observe Y"
- Consider multiple possibilities; avoid jumping to conclusions
- Research documentation when mechanisms are unclear

**Verify systematically with instrumentation**:
```typescript
// DON'T: Change settings hoping it fixes the issue
// DO: Add logging to confirm which setting is being read
console.log('DEBUG [investigate]: config =', config, 'expected:', expectedValue);
```

- Add logging/debug code to test each hypothesis
- Create minimal reproductions to isolate the problem
- Test one hypothesis at a time; change only what's needed
- Follow the evidence: if hypothesis A fails, move to B

**Verify the logical chain**:
- Does identified cause explain ALL symptoms?
- Does it explain why original code/config didn't work?
- Can you reproduce the problem and fix reliably?

**Watch for inconsistent logic**:
- ❌ "Setting X to Y fixed it" (doesn't explain why original failed)
- ✅ "Setting X to Y fixed it because Z expected Y but received original value due to W"
</investigation_approach>

<cleanup>
## Cleanup After Fix

After identifying root cause and applying the fix:
- **Remove temporary instrumentation**: Debug logging, console statements added during hypothesis testing
- **Keep only essential fix code**: Changes that directly resolve the root cause
- **Test final state**: Confirm fix works without verification code

Example: If you tested hypotheses A (logging), B (config change), C (initialization order), and C was the fix → remove A and B, keep only C.
</cleanup>

<final_report>
## Investigation Report

Provide structured report with complete causal chain:

**Root Cause**: What broke and why it caused the symptoms
**Evidence**: Key findings from verification (what was tested, what was discovered)
**Fix Applied**: Essential changes and why they resolve the root cause
**Verification**: How the fix was tested

❌ Avoid: "Changed setting X to Y and it works now!" (no explanation of WHY)
✅ Provide: Complete logical chain explaining why original failed and why fix works
</final_report>

<error_handling>
## When Investigation Gets Stuck

If unable to identify root cause after systematic attempts:
- Document what was tried (hypotheses tested and results)
- Ask for additional context or symptoms
- Suggest alternative debugging approaches or tools

**Do NOT**: Make random changes, claim success without verification, or leave debug code
</error_handling>
