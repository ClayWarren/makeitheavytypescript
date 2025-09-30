# AGENTS.md

## Build/Lint/Test Commands
- Install dependencies: `npm install`
- Run single agent: `npm run dev`
- Run multi-agent: `npm run dev:heavy`
- Build project: `npm run build`
- Linting: `npm run lint` (ESLint) and `npm run lint:fix` for auto-fixes
- Formatting: `npm run format` (Prettier) and `npm run format:check` for checks
- No explicit tests found; use `jest` or `vitest` if tests are added.

## Code Style Guidelines
- **Imports**: Place at top of file, external libraries first, then local imports.
- **Formatting**: Use 2 spaces for indentation; use TypeScript types; run `npm run format` for consistency.
- **Naming**: Classes in PascalCase (e.g., OpenRouterAgent); functions/variables in camelCase.
- **Types**: Use TypeScript interfaces and types for all parameters and return values; avoid 'any'.
- **Error Handling**: Use try-catch blocks with specific error types; throw custom errors where possible.
- **Comments**: Use JSDoc comments for classes and methods; inline comments sparingly.
- **Linting**: Follow ESLint rules; run `npm run lint` to check and `npm run lint:fix` to auto-fix.
- **Structure**: Follow ESLint/Prettier rules; keep functions short; use descriptive names.