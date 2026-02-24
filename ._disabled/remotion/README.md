# Remotion Deterministic Video

This directory contains the Remotion React components for Phase 4.

## Structure
- `Root.tsx`: Main entry point for Remotion compositions.
- `compositions/`: Individual video templates (e.g., `KinematicSlider.tsx`).
- `index.ts`: Registration entry point.

## Deployment
This project is deployed to AWS Lambda via `npx remotion lambda sites create`.
The API triggers renders via `@remotion/lambda`.

## Determinism
All compositions MUST use the `seed` prop to drive any noise/randomness.
`seedrandom(seed)` is required. No `Math.random()`.
