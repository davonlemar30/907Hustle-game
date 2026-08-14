// Bundle entry point. esbuild walks these imports in order, and order matters:
// game-core.js publishes globalThis.GameCore from its UMD wrapper, and ui.jsx
// reads it at module scope on its very first line. Flipping these two lines
// gives the UI an undefined GameCore.
//
// React and ReactDOM stay UMD globals loaded from index.html. esbuild's default
// JSX factory emits React.createElement, which resolves to that global without
// an import, so React never enters the bundle.
import "../game-core.js";
import "../ui.jsx";
