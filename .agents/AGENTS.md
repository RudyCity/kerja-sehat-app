# Agents Custom Rules: Kerja Sehat App

You must strictly follow these rules and guidelines when developing, modifying, or refactoring code in this project:

## Code Quality & Architecture
1. **Best Practices**: Always write clean, idiomatic code. Use appropriate design patterns and adhere to language-specific standard formatting and linting rules.
2. **Modular Design**: Structure the project components and modules logically. Avoid large monolithic files or tightly-coupled structures.
3. **Maintainability**: Ensure code is self-documenting with clear naming conventions. Add helpful comments explaining the *why* rather than the *what* where necessary.
4. **Scalability**: Write code that is designed to accommodate future features and scale smoothly without requiring major rewrites of existing components.
5. **File Size Limit (Max 1000 Lines)**: 
   - A single source code file (whether Rust, TypeScript, CSS, or other languages) **MUST NOT** exceed **1000 lines**.
   - If a file starts approaching or exceeding this limit, you must refactor it, extract functions/classes/components, and split the code into separate modular files.

## Project Lifecycle & Release Management
1. **Version Control & Version Bumping**:
   - For every feature implementation, bug fix, or significant refactoring, increment the application version.
   - For Tauri/Rust, update the version in `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
   - For Node.js frontend, update the version in `package.json`.
2. **Changelog Maintenance**:
   - Maintain a clear and chronological `CHANGELOG.md` file in the root of the project.
   - Log every version bump with details of changes, additions, fixes, and improvements.
3. **Documentation Updates**:
   - When introducing new configurations, scripts, features, or APIs, always update the `README.md` file in the root of the project to ensure user documentation remains accurate.
