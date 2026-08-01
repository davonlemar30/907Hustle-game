const { useEffect, useReducer, useState } = React;
const C = window.GameCore;
const money = (value) => `$${Math.round(value || 0)}`;
const areaOf = (state) => C.NEIGHBORHOODS.find((area) => area.id === state.world.currentNeighborhoodId);

function loadRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(C.SAVE_KEY));
    if (saved?.version === C.VERSION && saved?.run && saved?.world) return saved;
  } catch {}
  return C.createRun({ seed: Date.now() });
}

function Hud({ label, value, danger, good }) {
  return <div className={`hud-item${danger ? " danger" : ""}${good ? " good" : ""}`}><span className="k">{label}</span><span className="v">{value}</span></div>;
}

function Header({ state, onMenu }) {
  const cargo = C.selectors.cargoUsed(state);
  const heat = C.selectors.heatBand(state.player.heat);
  return <header className="top">
    <div className="brand-row"><div className="brand">907<b>Hustle</b><small>One Good Run · Alpha v0.5</small></div><button className="menu-btn" onClick={onMenu}>Menu</button></div>
    <div className="hud">
      <Hud label="Day" value={`${state.run.day}/7 · ${C.SLOTS[state.run.slot]}`} />
      <Hud label="Area" value={areaOf(state).name} />
      <Hud label="Cash" value={money(state.player.cash)} good />
      <Hud label="Debt" value={state.lender.balance ? money(state.lender.balance) : "Clear"} danger={state.run.day >= state.lender.dueDay && state.lender.balance > 0} />
      <Hud label="Health" value={`${state.player.health}/100`} danger={state.player.health < 40} />
      <Hud label="Heat" value={`${state.player.heat} · ${heat.label}`} danger={state.player.heat >= 8} />
      <Hud label="Cargo" value={`${cargo}/${C.selectors.cargoCapacity(state)}`} danger={cargo >= C.selectors.cargoCapacity(state)} />
      <Hud label="Power" value={C.selectors.crewPower(state, false)} />
    </div>
  </header>;
}

const NAV = [["market", "Market"], ["travel", "Travel"], ["operations", "Operations"], ["people", "People"], ["finances", "Finances"], ["recovery", "Recovery"]];
function Navigation({ tab, setTab }) { return <nav className="nav" aria-label="Primary game navigation">{NAV.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>; }
function PageHead({ title, sub }) { return <div className="page-head"><h1>{title}</h1><p>{sub}</p></div>; }
function Outcome({ label, value }) { return <div className="outcome"><span className="muted">{label}</span><b>{value}</b></div>; }

function Market({ state, onTrade }) {
  const area = areaOf(state);
  const market = state.world.markets[area.id];
  return <><PageHead title="Street Market" sub={`${area.name} · trade freely, then close the visit to spend one slot`} /><div className="scroll">
    <div className="market-grid market-head"><span>Product</span><span>Buy</span><span>Signal</span><span>Own</span></div>
    {C.PRODUCTS.map((product) => {
      const open = state.world.productAccess[product.id];
      const signal = C.selectors.priceSignal(state, area.id, product.id);
      const prices = C.selectors.tradeUnitPrices(state, product.id);
      return <div key={product.id} className={`card product market-grid signal-${signal.id}${open ? "" : " locked"}`} role="button" tabIndex={open ? 0 : -1} onClick={() => open && onTrade(product.id)}>
        <div><div className="product-name">{product.name}</div><div className="role">{open ? `${product.role} · ${market.availability[product.id]} available` : `Locked · ${product.access} access`}</div></div>
        <div className="price">{open ? money(prices.buy) : "—"}</div><div className="signal">{open ? `${signal.symbol} ${signal.label}` : "LOCK"}</div><div className="own">{state.player.inventory[product.id].qty}</div>
      </div>;
    })}
  </div></>;
}

function Travel({ state, dispatch, setTab }) {
  return <><PageHead title="Travel" sub="Travel closes the market visit and advances exactly one slot" /><div className="scroll">{C.NEIGHBORHOODS.map((area) => {
    const here = area.id === state.world.currentNeighborhoodId;
    const owned = C.selectors.controlled(state, area.id);
    return <div className="card area-card" style={{ "--accent": area.accent }} key={area.id}>
      <div className="card-title">{area.name}<small>{here ? "HERE" : owned ? "YOUR TERRITORY" : "ROOK CONTROL"}</small></div>
      <p className="muted">{area.blurb}</p><div className="area-meta"><span>Risk {Math.max(0, area.risk - (owned ? 1 : 0))}/4</span><span>Police {area.police}/3</span><span>Influence {state.world.influence[area.id]}/4</span></div>
      <button className="btn full primary" disabled={here} onClick={() => { dispatch({ type: "TRAVEL", neighborhoodId: area.id }); setTab("market"); }}>{here ? "Current neighborhood" : `Travel to ${area.name}`}</button>
    </div>;
  })}</div></>;
}

function TerritoryCard({ state, dispatch, definition }) {
  const territory = state.world.territories[definition.areaId];
  const crewOnly = C.selectors.takeoverReadiness(state, definition.areaId, false);
  const joined = C.selectors.takeoverReadiness(state, definition.areaId, true);
  const estimate = C.selectors.territoryPowerEstimate(state, definition.areaId);
  const name = C.NEIGHBORHOODS.find((area) => area.id === definition.areaId).name;
  if (territory.owner === "player") return <div className="card cleared-card"><div className="card-title">{name}<small>CONTROLLED</small></div><p className="compact">Daily income {money(definition.dailyIncome)} · 4% better buying and selling · risk reduced by 1.</p><p className="muted compact">{definition.special} Total collected: {money(territory.incomeCollected)}.</p></div>;
  return <div className="card debt-card"><div className="card-title">Attack {name}<small>{money(definition.attackCost)} · 1 slot</small></div>
    <p className="compact">Your crew Power: <b>{C.selectors.crewPower(state, false)}</b> · Rook estimate: <b>{estimate.label}</b></p>
    <p className="muted compact">Best of three automatic rounds. Ties favor Rook. A loss permanently removes one participating crew member.</p>
    <button className="btn full secondary" disabled={!crewOnly.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: false })}>Send the crew<span className="action-copy">{crewOnly.available ? `Power ${crewOnly.crewPower} · you stay safe` : crewOnly.reason}</span></button>
    <button className="btn full primary choice" disabled={!joined.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: true })}>Join the attack<span>Power {C.selectors.crewPower(state, true)} · lose 20–30 Health if the operation fails</span></button>
  </div>;
}

function Operations({ state, dispatch }) {
  const robbery = C.selectors.robberyAvailability(state);
  return <><PageHead title="Operations" sub="Build the crew, recover working capital, and challenge Rook for Anchorage" /><div className="scroll">
    <div className="outcome-grid"><Outcome label="Crew Power" value={C.selectors.crewPower(state, false)} /><Outcome label="Working capital" value={money(C.selectors.workingCapital(state))} /><Outcome label="Territories" value={`${C.TERRITORIES.filter((item) => C.selectors.controlled(state, item.areaId)).length}/3`} /><Outcome label="Rook pressure" value={state.rival.pressure} /></div>
    <div className="card"><div className="card-title">Emergency robbery<small>Once per run · 1 slot</small></div><p className="muted">A comeback option when working capital falls below {money(C.WORKING_CAPITAL_RESERVE)}. It is dangerous and never the best profit strategy.</p><button className="btn full primary" disabled={!robbery.available} onClick={() => dispatch({ type: "ROBBERY" })}>Attempt the score<span className="action-copy">{robbery.available ? `${robbery.chanceLabel} estimated success` : robbery.reason}</span></button></div>
    <div className="section-label">Territory takeover</div>{C.TERRITORIES.map((definition) => <TerritoryCard key={definition.areaId} state={state} dispatch={dispatch} definition={definition} />)}
    {!state.base.visiting && <button className="btn full secondary" onClick={() => dispatch({ type: "VISIT_BASE" })}>Visit North Star Garage · 1 slot</button>}
    <div className="section-label">Operation gear</div>{C.GEAR.map((gear) => { const owned = state.player.gear.owned.includes(gear.id); return <div className="card" key={gear.id}><div className="card-title">{gear.name}<small>{owned ? "EQUIPPED" : money(gear.cost)}</small></div><p className="compact muted">{gear.description}</p><button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < gear.cost || (owned && gear.id !== "medical_kit")} onClick={() => dispatch({ type: "BUY_GEAR", gearId: gear.id })}>{owned ? "Owned" : "Buy · 1 slot"}</button></div>; })}
  </div></>;
}

function CrewCard({ state, dispatch, person }) {
  const crew = state.people.crew[person.id];
  const cost = C.selectors.recruitmentCost(state, person.id);
  return <div className={`card${crew.introduced ? "" : " locked"}`}><div className="card-title">{person.name}<small>{crew.status === "gone" ? "PERMANENTLY OUT" : `${person.role} · Power ${person.power}`}</small></div><p className="compact muted">{person.description}</p>
    {!crew.introduced ? <span className="tag">Not introduced</span> : !crew.recruited ? <button className="btn full good-btn" disabled={!state.base.visiting || state.player.cash < cost || C.selectors.recruitedCrew(state).length >= 2} onClick={() => dispatch({ type: "RECRUIT_CREW", crewId: person.id })}>Recruit · {money(cost)} · 1 slot</button> : <><p className="compact">Loyalty {crew.loyalty} · wages {money(crew.wageDue)} · {crew.status}</p>{crew.status === "active" && crew.wageDue > 0 && <button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < crew.wageDue} onClick={() => dispatch({ type: "PAY_CREW", crewId: person.id })}>Pay wages · {money(crew.wageDue)}<span className="action-copy">Clears the unpaid Power penalty without spending a slot</span></button>}</>}
  </div>;
}

function People({ state, dispatch }) {
  return <><PageHead title="People" sub="Trust, wages, and loyalty change what the operation can survive" /><div className="scroll">
    <div className="card"><div className="card-title">Mara Velez<small>{state.people.mara.status} · Trust {state.people.mara.trust}</small></div><p className="muted">{state.people.mara.met ? "The Mini-Mart clerk knows enough to make her own choices about your operation." : "You have not had a real conversation yet."}</p><button className="btn full secondary" disabled={!state.people.mara.met || state.player.cash < 40} onClick={() => dispatch({ type: "VISIT_MARA" })}>Meet after close · $40 · 1 slot</button></div>
    <div className="card"><div className="card-title">Dre Holloway<small>{state.lender.relationship}</small></div><p className="muted">Balance {money(state.lender.balance)} · trust {state.lender.trust}. He measures promises in payments.</p></div>
    <div className="card"><div className="card-title">Rook Mercer<small>{state.rival.relationship}</small></div><p className="muted">Pressure {state.rival.pressure} · respect {state.rival.respect}. His crew controls every neighborhood you have not taken.</p></div>
    <div className="section-label">Crew · {C.selectors.recruitedCrew(state).length}/2 active</div>{C.CREW.map((person) => <CrewCard key={person.id} state={state} dispatch={dispatch} person={person} />)}
  </div></>;
}

function Finances({ state, dispatch }) {
  const [amount, setAmount] = useState("");
  const safe = C.selectors.safeDebtPayment(state);
  const maximum = Math.min(state.player.cash, state.lender.balance);
  const payment = Math.max(0, Math.floor(Number(amount) || 0));
  const breaksReserve = payment > safe;
  function pay() {
    if (breaksReserve && !window.confirm(`This leaves less than ${money(C.WORKING_CAPITAL_RESERVE)} in working cash. Pay Dre anyway?`)) return;
    dispatch({ type: "PAY_DEBT", amount: payment }); setAmount("");
  }
  return <><PageHead title="Finances" sub={`Net worth ${money(C.selectors.netWorth(state))} · debt is due Day ${state.lender.dueDay} Night`} /><div className="scroll">
    <div className="card debt-card"><div className="debt-kicker">Dre's note</div><div className="debt-amount">{state.lender.balance ? money(state.lender.balance) : "Paid in full"}</div><div className="debt-meta"><span>Original $620</span><span>{state.lender.relationship} · trust {state.lender.trust}</span></div>
      {state.lender.balance > 0 && <><div className="field-row payment-row"><input aria-label="Debt payment" type="number" min="1" max={maximum} value={amount} placeholder="Payment" onChange={(event) => setAmount(event.target.value)} /><button className="btn secondary" onClick={() => setAmount(safe)}>SAFE</button><button className="btn primary" disabled={!payment || payment > maximum} onClick={pay}>Pay · 1 slot</button></div>{breaksReserve && <p className="warn compact">Warning: this payment leaves less than {money(C.WORKING_CAPITAL_RESERVE)} for product and recovery.</p>}</>}
    </div>
    <div className="outcome-grid"><Outcome label="Street cash" value={money(state.player.cash)} /><Outcome label="Garage cash" value={money(state.base.storedCash)} /><Outcome label="Inventory value" value={money(C.selectors.inventoryValue(state))} /><Outcome label="Debt paid" value={money(state.lender.payments)} /></div>
  </div></>;
}

function Recovery({ state, dispatch }) {
  return <><PageHead title="Recovery" sub="Repair health or lower Heat; each action advances one slot" /><div className="scroll">
    <div className="card"><div className="card-title">Health<small>{state.player.health}/100</small></div><div className="meter"><span style={{ width: `${state.player.health}%`, background: state.player.health < 40 ? "var(--red)" : "var(--green)" }} /></div></div>
    {[[18, 55, "First aid"], [40, 135, "Clinic visit"], [75, 290, "No-questions doctor"]].map(([amount, cost, name]) => <div className="card inventory-row" key={name}><div><div className="card-title">{name}</div><div className="muted">Restore up to {amount} Health</div></div><button className="btn good-btn" disabled={state.player.cash < cost || state.player.health >= 100} onClick={() => dispatch({ type: "HEAL", amount, cost })}>{money(cost)}</button></div>)}
    <div className="card"><div className="card-title">Lay low<small>1 slot</small></div><p className="muted">Lower Heat while markets, debt, wages, and Rook continue moving.</p><button className="btn full secondary" onClick={() => dispatch({ type: "LAY_LOW" })}>Kill the lights</button></div>
  </div></>;
}

function Modal({ title, children }) { return <div className="modal-backdrop"><div className="modal"><h2>{title}</h2>{children}</div></div>; }
function TradeModal({ state, productId, dispatch, onClose }) {
  const [mode, setMode] = useState("buy"); const [qty, setQty] = useState(1);
  const product = C.PRODUCTS.find((item) => item.id === productId); const market = state.world.markets[state.world.currentNeighborhoodId]; const item = state.player.inventory[productId]; const prices = C.selectors.tradeUnitPrices(state, productId);
  const maxBuy = Math.min(market.availability[productId], C.selectors.cargoCapacity(state) - C.selectors.cargoUsed(state), Math.floor(state.player.cash / prices.buy));
  const max = mode === "buy" ? maxBuy : item.qty; const selected = Math.max(0, Math.min(qty, max));
  return <Modal title={`${product.name} trade`}><p>Prices stay locked until you end this market visit.</p><div className="btn-row"><button className={`btn ${mode === "buy" ? "good-btn" : "secondary"}`} onClick={() => { setMode("buy"); setQty(1); }}>Buy</button><button className={`btn ${mode === "sell" ? "primary" : "secondary"}`} onClick={() => { setMode("sell"); setQty(1); }}>Sell</button></div><div className="trade-stats"><div className="trade-stat"><small>Unit price</small><b>{money(mode === "buy" ? prices.buy : prices.sell)}</b></div><div className="trade-stat"><small>Maximum</small><b>{max}</b></div></div><div className="qty"><button className="btn secondary qty-wide" onClick={() => setQty(Math.max(1, selected - 5))}>−5</button><button className="btn secondary" onClick={() => setQty(Math.max(1, selected - 1))}>−</button><input type="number" min="1" max={max} value={selected} onChange={(event) => setQty(Number(event.target.value))} /><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 1))}>+</button><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 5))}>+5</button><button className="btn secondary" onClick={() => setQty(max)}>MAX</button></div><div className="btn-row"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!selected} onClick={() => { dispatch({ type: mode === "buy" ? "BUY" : "SELL", productId, qty: selected }); onClose(); }}>{mode} {selected}</button></div></Modal>;
}
function BackgroundModal({ dispatch }) { return <Modal title="Choose your background"><p>Every background starts with $375, 10 cargo, and the same debt. Your strengths change how you solve the week.</p>{C.BACKGROUNDS.map((background) => <button className="btn full choice secondary" key={background.id} onClick={() => dispatch({ type: "CHOOSE_BACKGROUND", backgroundId: background.id })}>{background.name}<span>Combat {background.combat} · Charisma {background.charisma} · Intelligence {background.intelligence}. {background.description}</span></button>)}</Modal>; }
function EventModal({ event, dispatch }) { return <Modal title={event.title}><div className="outcome-grid"><Outcome label="Who" value={event.who} /><Outcome label="Where" value={event.where} /></div><p>{event.description}</p><p className="warn"><b>Stakes:</b> {event.stakes}</p>{event.choices.map((choice, index) => <button className="btn full choice secondary" key={choice.label} onClick={() => dispatch({ type: "RESOLVE_EVENT", choiceIndex: index })}>{choice.label}<span>{choice.preview}</span></button>)}</Modal>; }
function EncounterModal({ state, dispatch }) { const encounter = state.run.pendingEncounter; return <Modal title={encounter.title}><p>{encounter.feedback || encounter.description}</p><div className="outcome-grid"><Outcome label="Your Health" value={state.player.health} /><Outcome label={`${encounter.enemyName} resolve`} value={encounter.enemyHealth} /></div>{C.selectors.encounterChoices(state).map((choice) => <button className="btn full choice primary" key={choice.id} onClick={() => dispatch({ type: "RESOLVE_ENCOUNTER", choiceId: choice.id })}>{choice.label}<span>{choice.description}</span></button>)}</Modal>; }
function OperationResultModal({ result, dispatch }) { return <Modal title={result.title}><p>{result.summary}</p>{result.rounds?.map((round) => <div className="card compact" key={round.round}>Round {round.round}: Crew {round.attackTotal} vs Rook {round.defenseTotal} — <b>{round.winner === "player" ? "crew wins" : "Rook wins"}</b></div>)}<div className="recap">{result.effects.join(" · ")}</div><button className="btn full primary" onClick={() => dispatch({ type: "ACKNOWLEDGE_OPERATION_RESULT" })}>Continue the run</button></Modal>; }
function DayModal({ summary, dispatch }) { return <Modal title={`End of Day ${summary.day}`}><p>The market closes. Wages, territory income, Dre's note, and Rook's pressure have all moved.</p><div className="outcome-grid"><Outcome label="Operation score" value={summary.operationScore} /><Outcome label="Net worth" value={money(summary.netWorth)} /><Outcome label="Debt" value={money(summary.debt)} /><Outcome label="Heat / Health" value={`${summary.heat} / ${summary.health}`} /></div><button className="btn full primary" onClick={() => dispatch({ type: "DISMISS_DAY_SUMMARY" })}>Start Day {summary.day + 1}</button></Modal>; }
function EndModal({ state, dispatch }) { const summary = C.selectRunSummary(state); return <Modal title={summary.endingLabel}><p>Seven days. This is the operation—and the damage—that survived.</p><div className="outcome-grid"><Outcome label="Operation score" value={summary.operationScore} /><Outcome label="Net worth" value={money(summary.netWorth)} /><Outcome label="Territories" value={`${summary.territories.filter((item) => item.owner === "player").length}/3`} /><Outcome label="Takeovers" value={`${summary.takeovers.wins}W / ${summary.takeovers.losses}L`} /><Outcome label="Debt" value={money(summary.debt)} /><Outcome label="Crew" value={summary.crew.length} /></div><div className="recap">Dre: {summary.lenderRelationship}. Rook: {summary.rivalRelationship}. {summary.majorDecisions.slice(-3).join(" ")}</div><button className="btn full primary" onClick={() => dispatch({ type: "NEW_RUN", seed: Date.now() })}>Start another run</button></Modal>; }
function MenuModal({ state, dispatch, onClose }) { return <Modal title="Run menu"><p>Alpha v0.5 auto-saves to <b>{C.SAVE_KEY}</b>. The v0.4 save remains untouched.</p><button className="btn full primary" onClick={() => { dispatch({ type: "NEW_RUN", seed: Date.now() }); onClose(); }}>New run</button><button className="btn full secondary choice" onClick={onClose}>Return</button><p className="muted">Seed {state.run.seed} · Core v{state.version}</p></Modal>; }
function Feed({ entries }) { return <div className="feed" aria-label="Street feed">{entries.slice(0, 8).map((entry, index) => <div key={index} className={`feed-line ${entry.tone || ""}`}><time>{entry.stamp}</time>{entry.text}</div>)}</div>; }

function App() {
  const [state, dispatch] = useReducer(C.reduceGame, null, loadRun); const [tab, setTab] = useState("market"); const [trade, setTrade] = useState(null); const [menu, setMenu] = useState(false);
  useEffect(() => { try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(state)); } catch {} }, [state]);
  useEffect(() => { if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult || state.run.status === "ended") setTrade(null); }, [state.run.pendingEvent, state.run.pendingEncounter, state.run.pendingOperationResult, state.run.status]);
  const screens = { market: <Market state={state} onTrade={setTrade} />, travel: <Travel state={state} dispatch={dispatch} setTab={setTab} />, operations: <Operations state={state} dispatch={dispatch} />, people: <People state={state} dispatch={dispatch} />, finances: <Finances state={state} dispatch={dispatch} />, recovery: <Recovery state={state} dispatch={dispatch} /> };
  return <div className="app"><Header state={state} onMenu={() => setMenu(true)} /><Navigation tab={tab} setTab={setTab} /><main className="main">{screens[tab]}</main><div><Feed entries={state.log} /><div className="action-bar"><button className="btn secondary" onClick={() => setTab("travel")}>Travel<small>Choose a neighborhood</small></button><button className="btn primary" onClick={() => dispatch({ type: "END_MARKET" })}>End Market<small>Costs 1 slot</small></button><button className="btn secondary" onClick={() => dispatch({ type: "LAY_LOW" })}>Lay Low<small>Costs 1 slot</small></button></div></div>
    {trade && <TradeModal state={state} productId={trade} dispatch={dispatch} onClose={() => setTrade(null)} />}{menu && <MenuModal state={state} dispatch={dispatch} onClose={() => setMenu(false)} />}{state.run.status === "choosing_background" && <BackgroundModal dispatch={dispatch} />}{state.run.daySummary && state.run.status === "playing" && <DayModal summary={state.run.daySummary} dispatch={dispatch} />}{!state.run.daySummary && state.run.pendingOperationResult && <OperationResultModal result={state.run.pendingOperationResult} dispatch={dispatch} />}{!state.run.daySummary && !state.run.pendingOperationResult && state.run.pendingEvent && <EventModal event={state.run.pendingEvent} dispatch={dispatch} />}{!state.run.daySummary && !state.run.pendingOperationResult && state.run.pendingEncounter && <EncounterModal state={state} dispatch={dispatch} />}{state.run.status === "ended" && <EndModal state={state} dispatch={dispatch} />}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
