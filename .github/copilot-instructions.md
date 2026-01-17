---
name: Matterbridge Roborock Vacuum Plugin Instructions
description: Aligns Copilot with the coding style and architecture of the Matterbridge Roborock Vacuum Plugin project.
---

# Matterbridge Roborock Vacuum Plugin Copilot Instructions

## Key Recommendations

1. **Task Classification**

- Before making any code changes, always classify the user request as either unit test, logic/feature, or release note.
- Use the correct child instruction file for each task type:
  - Unit tests: `instructions/unit-test.instructions.md`
  - Logic/features: `instructions/typescript-5-esnext.instructions.md`
  - Release notes: `instructions/release-note.instructions.md`
- Never mix logic and test changes in a single step—split them and follow the relevant child instructions.

2. **Coding Standards**

- Remove unused variables, functions, and imports to keep the code clean.
- If something must remain unused, rename it to an underscore `_` to indicate intentional non-use.

3. **Troubleshooting**

- After running `npm install`, run `npm run deepCleanB` to resolve potential build issues.

4. **Unclear Task Type**

- If the task type is unclear, ask for clarification before proceeding.

5. **Child Instruction Enforcement**

- Always treat the selected child instruction file as the only source of truth for implementation details.

---

End of Copilot root instructions.
