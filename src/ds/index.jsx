// Design-system entry point. This is the surface that gets bundled for
// claude.ai/design — everything exported here becomes a component the design
// agent can build with, so keep it to primitives that are genuinely reusable
// and genuinely free of game state.
//
// Built by `npm run build:ds` into ds-dist/, alongside the hand-written
// ds-dist/index.d.ts that carries the prop contracts.
export * from "./primitives.jsx";
