---
description: 'When to use: 箇条書きコンテンツから技術記事を執筆したいとき'
disable-model-invocation: true
user-invocable: true
allowed-tools: Skill, Task, Read, Write, Edit
---

**IMPORTANT**: Enable the `article-writing` skill to access writing guidelines.

Transform bullet-point technical content into a natural, readable article following established style guidelines.

<workflow>
## Workflow

### Step 1: Understand the Content

- Review the bullet-point content provided by the user
- Clarify any ambiguities if needed:
  - Target audience (beginners, intermediate, advanced)
  - Article length preference
  - Key points to emphasize
  - Technical detail level

### Step 2: Write the Article

Transform the bullet points into a natural article following the guidelines:

- **Introduction**: Background, problem statement, personal motivation
- **Main Content**: Structured with h2/h3 headings (no numbers)
- **Code Examples**: Properly formatted with language specification
- **Conclusion**: Summary, call-to-action, next steps

Apply natural writing style:
- Casual です・ます tone
- Personal perspective ("〜してみました", "〜と思います")
- Short paragraphs with natural flow
- Avoid AI-like patterns (numbered headings, excessive ordered lists, overly formal language)

### Step 3: Parallel Review (4 Sessions)

Launch 4 parallel review sessions in a **single message**:

**Style Reviews** (2 parallel sessions):
```
Task(
  subagent_type="article-style-reviewer",
  prompt="""Review the following article for writing style and AI-like patterns.

**IMPORTANT - Content Integrity Check**:
Compare the article against the original bullet points below. Ensure that:
- No original content has been deleted or omitted
- No new claims or assertions were added that weren't in the original
- The core message and intent remain unchanged
- Content was only supplemented, structured, or made more readable

Original bullet points:
---
{original_bullet_points}
---

Article to review:
---
{article_content}
---

Provide feedback on both writing style AND content integrity.""",
  description="Style review (1/2)"
)

Task(
  subagent_type="article-style-reviewer",
  prompt="""Review the following article for writing style and AI-like patterns.

**IMPORTANT - Content Integrity Check**:
Compare the article against the original bullet points below. Ensure that:
- No original content has been deleted or omitted
- No new claims or assertions were added that weren't in the original
- The core message and intent remain unchanged
- Content was only supplemented, structured, or made more readable

Original bullet points:
---
{original_bullet_points}
---

Article to review:
---
{article_content}
---

Provide feedback on both writing style AND content integrity.""",
  description="Style review (2/2)"
)
```

**Content Reviews** (2 parallel sessions):
```
Task(
  subagent_type="article-content-reviewer",
  prompt="""Review the following article for technical accuracy and logical consistency.

**IMPORTANT - Content Integrity Check**:
Compare the article against the original bullet points below. Ensure that:
- No original content has been deleted or omitted
- No new technical claims were added that weren't in the original
- The core technical message remains unchanged
- Content was only supplemented, structured, or clarified

Original bullet points:
---
{original_bullet_points}
---

Article to review:
---
{article_content}
---

Provide feedback on both technical accuracy AND content integrity.""",
  description="Content review (1/2)"
)

Task(
  subagent_type="article-content-reviewer",
  prompt="""Review the following article for technical accuracy and logical consistency.

**IMPORTANT - Content Integrity Check**:
Compare the article against the original bullet points below. Ensure that:
- No original content has been deleted or omitted
- No new technical claims were added that weren't in the original
- The core technical message remains unchanged
- Content was only supplemented, structured, or clarified

Original bullet points:
---
{original_bullet_points}
---

Article to review:
---
{article_content}
---

Provide feedback on both technical accuracy AND content integrity.""",
  description="Content review (2/2)"
)
```

### Step 4: Aggregate Feedback

- Collect all 4 review results
- Identify common issues across reviews
- Prioritize fixes: Critical > Moderate > Minor

### Step 5: Apply Improvements

- Fix critical issues (factual errors, major style problems)
- Apply moderate improvements (clarity, flow, technical accuracy)
- Consider minor suggestions based on context

### Step 6: Present Final Article

- Show the improved article to the user
- Summarize key changes made based on reviews
- Highlight any remaining considerations or user decisions needed
</workflow>

<important_notes>
## Important Notes

- **Parallel execution**: Run all 4 review tasks in a single message for efficiency
- **Skill loading**: Enable `article-writing` skill in the main session; subagents (`article-style-reviewer`) auto-load it via front matter
- **Style priority**: AI-like patterns are critical to fix (numbered headings, excessive ol, formal language)
- **Factual accuracy**: Technical errors are critical; verify claims carefully
- **User engagement**: Ask clarifying questions when the content is ambiguous
</important_notes>
