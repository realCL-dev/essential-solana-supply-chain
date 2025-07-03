# Gemini Customization

This file helps customize Gemini's behavior for this project.

## Project Description

A brief description of the project can go here. This will help Gemini understand the project's purpose and context.

## Development Commands

You can specify common development commands here. Gemini can use these to perform tasks like running tests, building the project, or starting a development server.

Example:
```json
{
  "commands": {
    "test": "npm run test",
    "build": "npm run build",
    "start": "npm run dev"
  }
}
```

## File/Directory Ignores

You can specify files and directories that Gemini should ignore. This is useful for preventing Gemini from accessing sensitive information or large, irrelevant directories.

Example:
```json
{
  "ignore": [
    ".next/",
    "node_modules/",
    "target/"
  ]
}
```

## Project Notes

- The project uses a dual-wallet system: `@wallet-ui/react` for desktop and `@solana/wallet-adapter-react` for mobile.
- The core logic for switching between these wallet systems is in `src/components/supply_chain/enhanced-supply_chain-feature.tsx`.
- Mobile-specific features that require HTTPS (like the camera) are tested via Vercel deployments, which are triggered by pushing to GitHub.
- The local development command is `npm run dev`.