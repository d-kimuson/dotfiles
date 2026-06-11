---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
disable-model-invocation: true
user-invocable: true
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions.

## Question format

**Batch independent decisions.** Group every question that does not depend on the answer to another pending question into a single batch. For each question, state your **assumed answer** (the most reasonable default given the available context). The user replies only to questions where the assumption is wrong or refinement is needed — silence on a question means the assumption is accepted.

**Ask dependent decisions one at a time.** When one decision gates the next, ask it alone and wait for the answer before proceeding down that branch.

If a question can be answered by exploring the codebase, explore the codebase instead of asking.
