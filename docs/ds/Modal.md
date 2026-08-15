---
category: Overlays
---

Backdrop and dialog shell for every popup in the game.

`Modal` supplies the backdrop, the dialog role, modal semantics, and the
accessible name; the caller supplies the body. Every popup in 907Hustle is built
on it — event cards, confirmations, results, the run menu — so a new overlay
should compose this rather than hand-rolling a backdrop.

```jsx
<Modal title="Run menu" onClose={close}>
  <button className="btn full secondary" onClick={save}>Save and quit</button>
  <button className="btn full ghost" onClick={restart}>Abandon run</button>
</Modal>
```

Omit `onClose` for a modal the player must answer — the close button disappears
and the only way out is through the body's own controls. Use that for anything
with a real consequence; use `onClose` for anything informational.

`className` is appended to the dialog and, suffixed with `-backdrop`, to the
backdrop. That pair is how a variant restyles both layers from one prop:

```jsx
<Modal title="Abandon this run?" className="confirm-modal">
  <p className="popup-lead">Your autosave will be replaced. This cannot be undone.</p>
  <div className="btn-row">
    <button className="btn secondary" onClick={cancel}>Cancel</button>
    <button className="btn primary" onClick={confirm}>Abandon</button>
  </div>
</Modal>
```

The close control is sized to a 44px minimum tap target — keep it that way.
