---
name: Matterbridge Roborock Vacuum Plugin Instructions
description: Aligns Copilot with the coding style and architecture of the Matterbridge Roborock Vacuum Plugin project.
---

# Matterbridge Roborock Vacuum Plugin Guidelines

# Copilot Instructions (Root Dispatcher)

This file is the **primary instruction entry point** for GitHub Copilot.
Its purpose is to **route tasks to the correct child instruction file**.

This plugin is implemented based on the pluginTemplate provided by Matterbridge and follows its architecture and coding style.
The example code is available at: root\pluginTemplate folder.

Copilot MUST follow the rules below before generating any code.

---

## Instruction Hierarchy

This repository uses a **two-layer instruction system**:

1. **Root dispatcher (this file)**
2. **Task-specific child instructions**

Child instruction files:

- `instructions/unit-test.instructions.md` → Unit test implementation
- `instructions/typescript-5-esnext.instructions.md` → Application / business logic implementation

Copilot must select **exactly one** child instruction set per task.

---

## Coding Standards
- for unused variables, functions, imports, etc., please remove them to keep the code clean.
- if can not remove unused variables, replace the name with an underscore `_` to indicate it's intentionally unused.

---

## Task Classification Rules

Before writing any code, Copilot must classify the user request into one of the following categories.

### 1. Unit Test Tasks → `instructions/unit-test.instructions.md`

Use **only** `instructions/unit-test.instructions.md` when the task involves **any** of the following:

- Writing new unit tests
- Updating existing unit tests
- Adding test coverage
- Testing edge cases
- Mocking, stubbing, or spying
- Test frameworks (e.g., Jest, Vitest, Mocha)
- Test utilities, fixtures, or test helpers
- Assertions, expectations, or snapshots

**Keywords that strongly indicate this path**:

- test
- unit test
- coverage
- mock
- stub
- spy
- assertion
- expect
- snapshot
- spec
- describe
- it
- beforeEach
- afterEach
- should
- must
- expect

**Folders and file patterns that strongly indicate this path**:

- `**/*.spec.ts`
- `**/*.test.ts`
- `**/tests/**`

**When this path is selected:**

- ❌ Do NOT implement or modify production logic unless explicitly required for test compilation
- ✅ Follow ALL rules in `instructions/unit-test.instructions.md`

---

### 2. Logic / Feature Tasks → `instructions/typescript-5-esnext.instructions.md`

Use **only** `instructions/typescript-5-esnext.instructions.md` when the task involves:

- Implementing application logic
- Writing or modifying TypeScript source code
- Adding features or business logic
- Refactoring non-test code
- Performance or readability improvements
- API, service, utility, or domain logic

**Keywords that strongly indicate this path**:

- implement
- feature
- logic
- refactor
- optimize
- performance
- readability
- API
- service
- utility
- domain
- business
- function
- method
- class
- interface
- type
- enum
- data
- configuration
- event
- error handling
- async
- architecture

**When this path is selected:**

- ❌ Do NOT write or modify unit tests unless explicitly required for production code compilation
- ✅ Follow ALL rules in `instructions/typescript-5-esnext.instructions.md`

---

## Conflict Resolution Rules

If a request appears to involve **both logic and tests**:

1. **Split the work conceptually**
2. Apply:
   - `instructions/typescript-5-esnext.instructions.md` for logic changes
   - `instructions/unit-test.instructions.md` for test changes
3. Clearly separate logic code from test code

If the user explicitly says:

> “only tests” → use unit-test instructions  
> “only logic” → use TypeScript instructions

User intent always overrides inference.

---

## Default Rule

If task classification is unclear:

1. **Ask for clarification**
2. Do NOT assume
3. Do NOT mix instruction sets

---

## Enforcement

- Never mix rules from both child instruction files in a single implementation
- Always behave as if the selected child instruction file is the **only source of truth**
- This file exists only to guide selection, not implementation details

---

## Troubleshooting

- after run `npm install`, run `npm run deepCleanB` to fix potential build issues.

End of root Copilot instructions.
