# Agent SDK User Input Guidelines

## Handle Approvals with canUseTool Callback

- Use the `canUseTool` callback to intercept tool calls before execution
- Return `{"approved": true}` to allow, `{"approved": false}` to block
- Useful for approval workflows and permission gates
- Works with all tools (Read, Write, Edit, Bash, etc.)

## Ask Clarifying Questions with AskUserQuestion

- Use the `AskUserQuestion` tool to ask users multiple-choice questions
- Supports 1-4 questions per call with 2-4 options each
- Enable `multiSelect: true` for checkbox-style selections
- Answers are returned as a dict mapping question text to user responses
- Multi-select answers are comma-separated strings

## AskUserQuestion Input Format

- `questions`: Array of question objects
  - `question`: The complete question text
  - `header`: Short label (max 12 chars)
  - `options`: Array of {label, description} pairs
  - `multiSelect`: Boolean for multiple selections

## Other Input Methods

- `canUseTool` callback: Pre-approve or block specific tools
- `AskUserQuestion` tool: Interactive multiple-choice prompts
- Session context: Maintain state across multiple queries
- Hooks: Validate or transform user input at key lifecycle points

## Best Practices

- Keep questions concise and options clear
- Use headers to categorize question types
- Combine `canUseTool` for automatic approvals with `AskUserQuestion` for complex decisions
- Test permission modes (acceptEdits, askApproval, blockEdits) for your use case
