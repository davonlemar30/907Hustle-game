const { useEffect, useMemo, useReducer, useRef, useState } = React;
const C = window.GameCore;
const money = (value) => `$${Math.round(value || 0)}`;
const signedMoney = (value) => `${value >= 0 ? "+" : "−"}$${Math.abs(Math.round(value || 0))}`;
const areaOf = (state) => C.NEIGHBORHOODS.find((area) => area.id === state.world.currentNeighborhoodId) || C.NEIGHBORHOODS[0];
// Passive organization activity is already summarized into one compact log
// line per crossed day (game-core's resolveSoldierOperations). Surface that
// same line as a small report surface instead of building a second event
// system; this keeps a single source of truth for "what happened".
const findEliReport = (state) => state.log.slice(0, 6).find((entry) => entry.text.startsWith("Eli's report:")) || null;
function EliReportCard({ state }) {
  const report = findEliReport(state);
  if (!report) return null;
  const severe = /Curtis takes|slips back under Curtis/.test(state.log[0]?.text || "");
  return <div className={`report-card ${report.tone === "warn" ? (severe ? "severe" : "warn") : "good"}`}><div className="card-title">Eli's Report</div><p>{report.text.replace("Eli's report: ", "")}</p></div>;
}

function readSave() {
  try {
    const current = C.inspectSave(localStorage.getItem(C.SAVE_KEY));
    if (current.valid) return current;
    const v4 = C.inspectSave(localStorage.getItem("907ogr_v4"));
    if (v4.valid) return v4;
    return C.inspectSave(localStorage.getItem("907ogr_v3"));
  }
  catch { return { exists: false, valid: false, state: null, preview: null, error: "Local saves are unavailable in this browser." }; }
}

function TitleScreen({ saveInfo, onLoad, onNew }) {
  const [help, setHelp] = useState(false);
  const preview = saveInfo.preview;
  return <div className="title-screen">
    <div className="title-backdrop" aria-hidden="true" />
    <img className="title-art" src="./assets/907hustle-title.png" alt="907Hustle: One Good Run over a rain-dark Spenard street" />
    <div className="title-shade" />
    <div className="title-content">
      <div className="sr-only"><h1>907Hustle: One Good Run</h1><p>Find your footing. Face the week you create.</p></div>
      <div className="title-actions">
        {preview && <div className="save-preview" aria-label="Saved run preview"><b>{preview.name}</b><span>Saved run · Day {preview.day} · {preview.part}</span><span>{preview.district} · {money(preview.cash)} cash · {money(preview.debt)} debt</span></div>}
        {saveInfo.error && <div className="save-error" role="alert">{saveInfo.error}</div>}
        <button className="btn full primary title-button" disabled={!saveInfo.valid} onClick={onLoad}>Load Game<span className="action-copy">{saveInfo.valid ? "Resume the exact autosaved run" : "No compatible autosave found"}</span></button>
        <button className="btn full secondary title-button" onClick={onNew}>New Game<span className="action-copy">Start fresh in Spenard with $100 clean</span></button>
        <button className="btn full ghost" aria-expanded={help} onClick={() => setHelp(!help)}>How to Play</button>
        {help && <div className="how-to">
          <b>Four parts per day, with the checkpoint set by your run.</b>
          <ExpandableMoreSection
            collapsedContent={<p>Work, travel, exploration, recovery, meetings, and major operations move the clock. Your first days establish a life in Spenard before the pressure starts.</p>}
            expandedContent={<p className="popup-flavor">Each day has Morning, Afternoon, Evening, and Night. Night actions open a confirmation gate before the city rolls into tomorrow.</p>} />
        </div>}
      </div>
    </div>
  </div>;
}

function Hud({ label, value, danger, good, flash }) {
  return <div className={`hud-item${danger ? " danger" : ""}${good ? " good" : ""}`} data-flash={flash || undefined}><span className="k">{label}</span><span className="v">{value}</span></div>;
}
// Secondary-row pressure indicators (Heat/Dre/Respect). Same label={} JSX
// shape as Hud so existing ui-contract token checks still find them, but
// carries its own escalation-tone styling instead of a single danger flag.
function Chip({ label, value, tone, flash }) {
  return <div className={`status-chip${tone ? ` ${tone}` : ""}`} data-flash={flash || undefined}><span className="k">{label}</span><span className="v">{value}</span></div>;
}

// Numbers changed silently, so the player had to remember the old value to
// notice the new one. Returns "up" or "down" for one animation frame's worth
// of time after a change, and null otherwise. The first render seeds the
// previous value without reporting, so loading a save never flashes.
function useValueFlash(value) {
  const seeded = React.useRef(false);
  const previous = React.useRef(value);
  const [direction, setDirection] = useState(null);
  useEffect(() => {
    if (!seeded.current) { seeded.current = true; previous.current = value; return; }
    const before = previous.current;
    previous.current = value;
    if (typeof value !== "number" || typeof before !== "number" || value === before) return;
    setDirection(value > before ? "up" : "down");
    const timer = setTimeout(() => setDirection(null), 420);
    return () => clearTimeout(timer);
  }, [value]);
  return direction;
}

// Time is the resource the whole run spends, and its only representation was a
// word. Four pips make the remaining budget countable without reading: spent
// slots dim, the current one is lit, the rest stay open. The text label stays
// alongside, and the pips are aria-hidden so nothing is announced twice.
function SlotPips({ slot }) {
  return <span className="slot-pips" aria-hidden="true">
    {C.SLOTS.map((label, index) => <span key={label} className={`slot-pip${index < slot ? " spent" : index === slot ? " now" : ""}`} />)}
  </span>;
}

// Which values the always-visible header is currently carrying. Home reads the
// same function so the two surfaces can never print the same number twice.
// The status drawer is deliberately excluded: it is collapsed by default, so
// what it holds is not on screen.
function headerShows(state) {
  const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared";
  const heat = state.player.heat >= 3;
  const debt = hasDreDebt && state.lender.balance > 0 && state.lender.dueDay - state.run.day <= 2;
  const respect = state.npc.curtis.respect > 0;
  const chipRow = hasDreDebt && (heat || debt || respect);
  return { chipRow, heat: chipRow && heat, debt: chipRow && debt, respect: chipRow && respect };
}

function Header({ state, onMenu }) {
  const [open, setOpen] = useState(false);
  // Cash reads either way; Heat only matters climbing, Health only falling.
  const cashMove = useValueFlash(state.player.cash);
  const heatMove = useValueFlash(state.player.heat);
  const healthMove = useValueFlash(state.player.health);
  const cashFlash = cashMove === "up" ? "good" : cashMove === "down" ? "bad" : null;
  const heatFlash = heatMove === "up" ? "warn" : null;
  const healthFlash = healthMove === "down" ? "bad" : null;
  const cargo = C.selectors.cargoUsed(state);
  const heat = C.selectors.heatBand(state.player.heat);
  const heatLabel = heat.id === "warm" ? "Building" : heat.label;
  const area = areaOf(state);
  const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared";
  const dreOverdue = hasDreDebt && state.lender.balance > 0 && state.run.day > state.lender.dueDay;
  const dreDueTonight = hasDreDebt && state.lender.balance > 0 && state.run.day === state.lender.dueDay;
  const dreValue = !state.lender.balance ? "Clear" : dreDueTonight ? "Due tonight" : dreOverdue ? "Overdue" : money(state.lender.balance);
  // Progressive HUD. The pressure row only renders once something on it is
  // actually applying pressure, so a first-Morning arrival gets one calm line
  // instead of inheriting a Day 6 operator's chrome. Every value stays one tap
  // away in the status drawer, and Home always shows the full situation.
  const shown = headerShows(state);
  const showHeat = state.player.heat >= 3;
  const showDebt = hasDreDebt && state.lender.balance > 0 && state.lender.dueDay - state.run.day <= 2;
  const showRespect = state.npc.curtis.respect > 0;
  const showCrew = C.selectors.recruitedCrew(state).length > 0;
  const showCurtis = state.npc.curtis.relationship !== "unaware";
  // The wordmark belongs to the title screen. On a play screen it was a full
  // 50px row of branding above every page, so it is now a screen-reader
  // heading and the Menu button rides the HUD line instead.
  return <header className="top">
    <h1 className="sr-only">907Hustle: One Good Run · v1.8</h1>
    <div className="hud primary-hud">
      <Hud label="Day / Time" value={<>{`${state.run.day}${state.run.checkpointDay ? `/${state.run.checkpointDay}` : ""} · ${C.SLOTS[state.run.slot]} · ${area.name}`}<SlotPips slot={state.run.slot} /></>} good />
      <Hud label="Cash" value={money(state.player.cash)} good flash={cashFlash} />
      <button className="status-toggle" aria-expanded={open} aria-label="Show more status" onClick={() => setOpen(!open)}>Status <span>{open ? "Hide" : "View"}</span></button>
      <button className="menu-btn" onClick={onMenu}>Menu</button>
    </div>
    {shown.chipRow && <div className="hud chip-row">
      {showHeat && <Chip label="Heat" value={`${state.player.heat}/15 · ${heatLabel}`} tone={state.player.heat >= 8 ? "escalated" : state.player.heat <= 2 ? "calm" : ""} flash={heatFlash} />}
      {showDebt && <Chip label="Debt" value={dreValue} tone={dreOverdue || dreDueTonight ? "escalated" : !state.lender.balance ? "calm" : ""} />}
      {showRespect && <Chip label="Respect" value={state.npc.curtis.respect} tone="" />}
    </div>}
    {open && <div className="hud status-drawer">
      <Hud label="Health" value={`${state.player.health}/100`} danger={state.player.health < 40} flash={healthFlash} />
      <Hud label="Heat" value={`${state.player.heat}/15 · ${heatLabel}`} danger={state.player.heat >= 8} flash={heatFlash} />
      {hasDreDebt && <Hud label="Debt" value={dreValue} danger={dreOverdue || dreDueTonight} />}
      <Hud label="Cargo" value={`${cargo}/${C.selectors.cargoCapacity(state)}`} danger={cargo >= C.selectors.cargoCapacity(state)} />
      <Hud label="Respect" value={state.npc.curtis.respect} />
      {showCrew && <Hud label="Crew Power" value={C.selectors.crewPower(state, false)} />}
      {showCurtis && <Hud label="Curtis" value={state.npc.curtis.relationship} />}
    </div>}
  </header>;
}

// Single-path glyphs, inlined so the bottom bar never waits on a font or an
// external request. Icons carry the tap target; the label names it.
const NAV_ICONS = {
  home: "M12 3 3 10.4V21h6v-6h6v6h6V10.4z",
  market: "M6.2 6h14l-1.7 8.7a2.2 2.2 0 0 1-2.2 1.8H9.4a2.2 2.2 0 0 1-2.2-1.8L5 3.5H1.6v-2H6.6zM9.5 21.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m7 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2",
  boost: "M4 5h16v4H4zM6 10h12l-1 11H7zM9 2h6v3H9zm1 11h4v5h-4z",
  rob: "M12 2l8 4v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6zm0 5v6m0 3v1",
  travel: "M12 1.8a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 13.2 7.2 13.2s7.2-7.8 7.2-13.2A7.2 7.2 0 0 0 12 1.8m0 9.9A2.7 2.7 0 1 1 12 6.3a2.7 2.7 0 0 1 0 5.4",
  people: "M9 12a4.1 4.1 0 1 0 0-8.2A4.1 4.1 0 0 0 9 12m0 1.9c-4.1 0-7.4 2.1-7.4 4.7v2.6h14.8v-2.6c0-2.6-3.3-4.7-7.4-4.7m8.8-2.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4m.4 2.1c-.8 0-1.5.1-2.2.3 1.9 1.1 3.1 2.7 3.1 4.4v2.6h5.3v-2.9c0-2.4-2.8-4.4-6.2-4.4",
  more: "M6 12a2.2 2.2 0 1 1-4.4 0A2.2 2.2 0 0 1 6 12m8.2 0a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0m8.2 0a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0",
  street: "M12 1.8a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 13.2 7.2 13.2s7.2-7.8 7.2-13.2A7.2 7.2 0 0 0 12 1.8m0 9.9A2.7 2.7 0 1 1 12 6.3a2.7 2.7 0 0 1 0 5.4",
  hustle: "M6.2 6h14l-1.7 8.7a2.2 2.2 0 0 1-2.2 1.8H9.4a2.2 2.2 0 0 1-2.2-1.8L5 3.5H1.6v-2H6.6zM9.5 21.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m7 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2",
  phone: "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m3 17h4",
};
function NavIcon({ id }) { return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={NAV_ICONS[id]} fill="currentColor" /></svg>; }

const NAV = [["home", "Home"], ["street", "Street"], ["hustle", "Hustle"], ["phone", "Phone"], ["more", "More"]];
function Navigation({ tab, setTab, hustleVisible }) {
  const items = NAV.filter(([id]) => id !== "hustle" || hustleVisible);
  return <nav className="nav" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(44px, 1fr))` }} aria-label="Primary game navigation">{items.map(([id, label]) => {
    return <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><NavIcon id={id} />{label}</button>;
  })}</nav>;
}
// Back button and the title block are flex siblings. The title and subtitle
// share one column so a subtitle that wraps stays beside the button instead of
// running under it and out of the header band.
function PageHead({ title, sub, onBack }) { return <div className="page-head">{onBack && <button className="back-btn" onClick={onBack}>← Back</button>}<div className="page-head-text"><h1>{title}</h1><p>{sub}</p></div></div>; }
function Outcome({ label, value }) { return <div className="outcome"><span className="muted">{label}</span><b>{value}</b></div>; }
function CategoryCard({ title, status, description, onClick, disabled }) { return <button className={`card category-card${disabled ? " locked" : ""}`} disabled={disabled} onClick={onClick}><div className="card-title">{title}<small>{status}</small></div><p>{description}</p><span className="category-arrow">Open →</span></button>; }
// Menu-hub row. Shorter than CategoryCard: hubs list destinations, and a wall
// of paragraphs is the density problem this pass exists to remove.
function MenuRow({ title, status, description, onClick, disabled, tone }) { return <button className={`menu-row${tone ? ` ${tone}` : ""}${disabled ? " locked" : ""}`} disabled={disabled} onClick={onClick}><span className="menu-row-main"><b>{title}</b>{description && <small>{description}</small>}</span><span className="menu-row-meta">{status}<span className="menu-row-arrow" aria-hidden="true">›</span></span></button>; }
function StatTile({ label, value, note, tone, text }) { return <div className={`stat-tile${tone ? ` ${tone}` : ""}${text ? " text" : ""}`}><span className="k">{label}</span><span className="v">{value}</span>{note && <span className="n">{note}</span>}</div>; }

// Home priorities are not a task list — they are shortcuts to the one screen
// that can actually resolve the pressure they name.
const PRIORITY_TARGETS = {
  debt_overdue: ["more", "finances", "debt"], debt_tonight: ["more", "finances", "debt"], debt_tomorrow: ["more", "finances", "debt"],
  health_critical: ["more", "recovery"], health_hurt: ["more", "recovery"], heat_critical: ["more", "recovery"], heat_high: ["more", "recovery"],
  block_pressure: ["more", "operations", "territory"], soldiers_idle: ["more", "operations", "soldiers"], wages_due: ["street", "root", null, "people"],
  phone_off: ["phone"], phone_due: ["phone"], rent_due: ["street", "root", null, "people"],
};

// The calmest screen in the game. Where am I, what time is it, what do I have,
// what is pressing, and where might I go — nothing else. Everything below the
// situation block is gated on progression, so Day 1 renders four tiles and a
// sentence while Day 6 renders the organization the player actually built.
// Home is where the player actually lives, plus whatever is pressing. The
// header already carries day, time, location, cash, and the pressure chips, so
// none of that is restated here. What is left is the room, the people in it,
// and the short list of things that will hurt if ignored.
function Home({ state, dispatch, navigate }) {
  const view = C.selectors.homeSituation(state);
  const shown = headerShows(state);
  const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared";
  const atHome = state.world.currentNeighborhoodId === C.HOME_DISTRICT_ID;
  const household = state.people.household;
  const storedProducts = C.PRODUCTS.reduce((total, product) => total + state.home.storedInventory[product.id].qty, 0);
  const askedToday = household.lastQuestionDay === state.run.day;
  const present = view.household.present;
  const openRoom = () => navigate("street", "root", null, "travel:household");
  // Health lives in the collapsed drawer, so it earns a tile. Heat and Debt
  // only earn one when the header chips are not already showing them.
  const showHeatTile = !shown.heat;
  const showDebtTile = hasDreDebt && !shown.debt;
  return <div className="scroll home">
    {view.priorities.length > 0 && <>
      <div className="section-label">Needs Attention</div>
      {view.priorities.map((item) => <button key={item.id} className={`priority-row ${item.tone}`} onClick={() => navigate(...(PRIORITY_TARGETS[item.id] || ["home"]))}><span className="menu-row-main"><b>{item.label}</b><small>{item.detail}</small></span><span className="menu-row-arrow" aria-hidden="true">›</span></button>)}
    </>}
    <div className="home-hero">
      <p className="home-summary">{view.summary}</p>
      <div className="home-identity"><span className="k">Street Identity</span><b>{view.identity.label}</b></div>
    </div>
    <div className="stat-row">
      <StatTile label="Health" value={view.health} note="of 100" tone={view.health < 40 ? "bad" : view.health < 70 ? "warn" : ""} />
      {showHeatTile && <StatTile label="Heat" value={view.heat.label} note={`${view.heat.value} of 15`} tone={view.heat.tone === "good" ? "" : view.heat.tone} text />}
      {showDebtTile && <StatTile label="Debt" value={view.debt.label} note={view.debt.note} tone={view.debt.tone} />}
    </div>
    <div className="section-label">Yalonda's Home</div>
    {atHome ? <>
      <MenuRow title="Stash" status={`${money(state.home.storedCash)} · ${storedProducts}/2 held`} description={household.evicted ? "The room is closed to you." : "Cash is safe here. Contraband is not."} onClick={openRoom} />
      {present && <button className="btn full secondary" disabled={household.evicted || askedToday} onClick={() => dispatch({ type: "TALK_HOUSEHOLD", npcId: present })}>Talk with {present === "yalonda" ? "Yalonda" : "Juan"}<span className="action-copy">{askedToday ? "Already talked today" : "Free · once daily"}</span></button>}
      {!present && <div className="card compact muted">The apartment is quiet right now.</div>}
      {state.run.day >= state.obligations.rentDueDay && <button className="btn full secondary" disabled={state.player.cash < C.WEEKLY_RENT} onClick={() => dispatch({ type: "PAY_RENT" })}>Pay weekly rent · {money(C.WEEKLY_RENT)}<span className="action-copy">Cash · no time passes</span></button>}
      <button className="btn full primary" disabled={household.evicted} onClick={() => dispatch({ type: "SLEEP_HOME" })}>Sleep at home<span className="action-copy">$0 · uses one part of day</span></button>
      <MenuRow title={state.phone.active ? "Phone" : "No Service"} status={state.phone.active ? `${state.phone.inbox.length} texts` : "Restoration directions"} description={state.phone.active ? "Texts, today's log, and word around town." : "Open the phone to see how to restore service."} onClick={() => navigate("phone")} />
      {state.inventory.laptop && C.selectors.nineZeroSevenListAccess(state, "home").visible && <MenuRow title="907List Laptop" status="5 today" description="Open the daily Home listings." onClick={() => navigate("more", "907list", "home")} />}
    </> : <MenuRow title="The spare room" status="Back in Spenard" description="Storage, Yalonda, Juan, and sleep wait until you return." onClick={openRoom} />}
  </div>;
}

// A four-column table earns its column headings at three products or more. At
// one or two it spends a header row and most of the screen on structure the
// player does not need yet, so the same rows render as self-contained cards.
const MARKET_TABLE_MIN = 3;
function Market({ state, onTrade }) {
  const area = areaOf(state); const market = state.world.markets[area.id];
  const products = C.selectors.visibleMarketProducts(state);
  const compact = products.length < MARKET_TABLE_MIN;
  const detail = (product) => ({ signal: C.selectors.priceSignal(state, area.id, product.id), prices: C.selectors.tradeUnitPrices(state, product.id), owned: state.player.inventory[product.id].qty });
  return <><PageHead title="Street Market" sub={`${area.name} · buy and sell freely; finishing the visit uses one part of day`} /><div className="scroll">
    {!compact && <div className="market-grid market-head"><span>Product</span><span>Buy</span><span>Signal</span><span>Own</span></div>}
    {products.map((product) => { const { signal, prices, owned } = detail(product);
      if (compact) return <div key={product.id} className={`card product-card signal-${signal.id}`} role="button" tabIndex={0} onClick={() => onTrade(product.id)} onKeyDown={(event) => event.key === "Enter" && onTrade(product.id)}>
        <div className="product-card-head"><span className="product-name">{product.name}</span><span className="product-owned">{owned} held</span></div>
        <div className="role">{product.role} · {market.availability[product.id]} available</div>
        <div className="product-card-foot"><span className="price">{money(prices.buy)}</span><span className="signal">{signal.symbol} {signal.label}</span></div>
      </div>;
      return <div key={product.id} className={`card product market-grid signal-${signal.id}`} role="button" tabIndex={0} onClick={() => onTrade(product.id)} onKeyDown={(event) => event.key === "Enter" && onTrade(product.id)}>
        <div><div className="product-name">{product.name}</div><div className="role">{product.role} · {market.availability[product.id]} available</div></div><div className="price">{money(prices.buy)}</div><div className="signal">{signal.symbol} {signal.label}</div><div className="own">{owned}</div>
      </div>; })}
  </div></>;
}

function Boost({ state, dispatch }) {
  const targets = C.selectors.visibleBoostTargets(state);
  const fieldCrew = C.selectors.recruitedCrew(state).filter((person) => person.canFieldAssign);
  return <><PageHead title="Boost" sub={`Tier ${state.boost.tier} · ${areaOf(state).name} · technique stays off the street`} /><div className="scroll">
    {state.boost.tier >= 3 && <div className="card"><div className="card-title">Boost crew<small>{state.boost.crewAssigned ? C.CREW.find((person) => person.id === state.boost.crewAssigned)?.name : "UNASSIGNED"}</small></div><div className="btn-row">{fieldCrew.map((person) => <button className="btn secondary" key={person.id} onClick={() => dispatch({ type: "ASSIGN_BOOST_CREW", crewId: person.id })}>{person.name.split(" ")[0]}</button>)}</div></div>}
    {targets.map((target) => {
      const availability = C.selectors.boostTargetAvailability(state, target.id);
      const banned = state.boost.storeBans.includes(target.id);
      const hit = state.boost.dailyHits[target.id] === state.run.day;
      const discovered = state.boost.discoveredWindows.includes(target.id);
      const window = target.tier === 2 && discovered ? `Best window: ${C.SLOTS[target.windowSlot]}` : null;
      const encounter = target.tier === 1 ? `You're browsing ${target.name}. The camera has a blind spot by the back aisle.` : target.tier === 2 ? `${target.name} has what you need behind minimal security. Move now or wait for a better window.` : "Pick the target, keep the crew moving, and deliver the merchandise to the fence.";
      return <div className={`card boost-target${availability.available ? "" : " locked"}`} key={target.id}><div className="card-title">{target.name}<small>TIER {target.tier} · ${target.take[0]}–${target.take[1]}</small></div><p className="compact">{encounter}</p><div className="outcome-grid"><Outcome label="Status" value={banned ? "Banned" : hit ? "Hit today" : "Ready"} />{target.tier === 2 && <Outcome label="Window" value={window || "Unknown"} />}</div>{target.tier === 2 && !discovered && <button className="btn full secondary" onClick={() => dispatch({ type: "ASK_BOOST_WINDOW", targetId: target.id })}>Ask around<span className="action-copy">Uses one social action</span></button>}<button className="btn full primary" disabled={!availability.available} onClick={() => dispatch({ type: "BOOST", targetId: target.id })}>Make the lift<span className="action-copy">{availability.available ? "Uses one part of day" : availability.reason}</span></button></div>;
    })}
    {state.boost.tier >= 3 && <div className="card"><div className="card-title">Fence<small>{Math.round(C.selectors.boostFenceRate(state.boost.fenceStanding) * 100)}% RATE</small></div><p className="compact">He looks at what you brought, quotes a number. Take it or try somewhere else.</p><button className="btn full good-btn" disabled={!state.boost.merchandise} onClick={() => dispatch({ type: "FENCE_BOOST_GOODS" })}>Sell ${state.boost.merchandise} merchandise<span className="action-copy">Standing {state.boost.fenceStanding}/5 · no time cost</span></button></div>}
  </div></>;
}

function PlaceAction({ title, status, purpose, cost, time, disabled, reason, onClick }) {
  return <div className={`card area-card${disabled ? " locked" : ""}`}><div className="card-title">{title}<small>{status}</small></div><p>{purpose}</p><div className="area-meta"><span>Cost {cost}</span><span>{time}</span></div><button className="btn full secondary" disabled={disabled} onClick={onClick}>{disabled ? "Unavailable" : "Go"}<span className="action-copy">{reason}</span></button></div>;
}

// ---------------------------------------------------------------------------
// Travel. Previously one page carrying home storage, work, four Spenard
// activities, transit, two districts and three property listings — the single
// worst scroll in the build. It is now a hub of focused pages, each answering
// one question.
// ---------------------------------------------------------------------------

// Where do I want to go? Nothing else. Unknown districts stay unknown: the
// page never leaks risk or market numbers for somewhere the player has not
// reached.
function Destinations({ state, dispatch, setTab, onBack }) {
  const here = state.world.currentNeighborhoodId;
  const knownOf = { north_star_lot: true, downtown: state.world.transport.downtownKnown, airport_industrial: state.world.transport.industrialRouteKnown };
  function go(area) {
    dispatch({ type: area.travelAction || "TRAVEL", neighborhoodId: area.id });
    setTab(area.id === "downtown" ? "travel" : state.market.visible ? "market" : "travel");
  }
  return <><PageHead title="Leave Spenard" sub="Known destinations and People Mover passes" onBack={onBack} /><div className="scroll">
    <Transit state={state} dispatch={dispatch} />
    {C.NEIGHBORHOODS.filter((area) => area.id !== C.HOME_DISTRICT_ID).map((area) => {
      const current = area.id === here;
      const known = knownOf[area.id] || current;
      const access = C.selectors.travelAvailability(state, area.id);
      const fare = access.cashCost ? "$5" : "Pass covers it";
      return <div className={`card destination-card${current ? " cleared-card" : ""}${!current && !access.available ? " locked" : ""}`} key={area.id}>
        <div className="card-title">{area.name}<small>{current ? "YOU ARE HERE" : known ? area.role.toUpperCase() : "UNVISITED"}</small></div>
        <p className="compact">{known ? area.blurb : "You have not been out here yet. What sells, what it costs you, and who works the block are all unknown until you go."}</p>
        <div className="destination-meta">
          <span>Fare {fare}</span>
          <span>{current ? "You are already here" : "One part of day"}</span>
          <span>{known ? `Risk ${area.risk}/5` : "Risk unknown"}</span>
          <span>{known ? `Rival presence ${area.rival}/5` : "Rival presence unknown"}</span>
        </div>
        {!current && <button className="btn full primary" disabled={!access.available} onClick={() => go(area)}>Go to {area.name}<span className="action-copy">{access.available ? `${access.reason} Uses one part of day.` : access.reason}</span></button>}
      </div>;
    })}
  </div></>;
}

// Fares and passes only.
function Transit({ state, dispatch, onBack }) {
  const covered = state.world.transport.weekPass || state.world.transport.dayPassDay === state.run.day;
  return <><PageHead title="Transit" sub="Fares, day passes, and weekly passes" onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">People Mover<small>{state.world.transport.weekPass ? "7-DAY PASS" : covered ? "DAY PASS" : "$5 A RIDE"}</small></div>
      <p className="compact">A single ride costs $5. A pass covers every ride it is valid for, and buying one costs no time.</p>
      <div className="outcome-grid"><Outcome label="Rides taken" value={state.world.transport.busRides} /><Outcome label="Today's fares" value={covered ? "Covered" : "$5 each"} /></div>
      <div className="btn-row">
        <button className="btn secondary" disabled={state.player.cash < 12 || covered} onClick={() => dispatch({ type: "BUY_BUS_PASS", passType: "day" })}>Day pass · $12<span className="action-copy">{covered ? "Already covered today" : "No time cost"}</span></button>
        <button className="btn secondary" disabled={state.player.cash < 45 || state.world.transport.weekPass} onClick={() => dispatch({ type: "BUY_BUS_PASS", passType: "week" })}>7-day pass · $45<span className="action-copy">{state.world.transport.weekPass ? "Already held" : "No time cost"}</span></button>
      </div>
    </div>
    <div className="card"><div className="card-title">Industrial Route<small>{state.world.transport.industrialRouteKnown ? "KNOWN" : "UNKNOWN"}</small></div><p className="compact muted">{state.world.transport.industrialRouteKnown ? "A trusted route out to the service roads is available whenever you want it." : "The service roads need Eli, a trusted ride, or a specific route. No fare buys the way in."}</p></div>
  </div></>;
}

function NightOwlStash({ state, dispatch }) {
  const [cashAmount, setCashAmount] = useState(50);
  const available = C.selectors.nightOwlStashAvailability(state);
  if (!available.available) return null;
  const stash = state.jobs.nightOwlStash;
  return <div className="card"><div className="card-title">Night Owl stash<small>{stash.mode ? stash.mode.toUpperCase() : "EMPTY"}</small></div>
    <p className="compact">Holds either $300 cash or three product units. Empty it before switching storage type.</p>
    <div className="outcome-grid"><Outcome label="Cash" value={`${money(available.cash)} / $300`} /><Outcome label="Product" value={`${available.product}/3`} /></div>
    {(stash.mode === null || stash.mode === "cash") && <div className="field-row"><input aria-label="Night Owl stash cash amount" type="number" min="1" value={cashAmount} onChange={(event) => setCashAmount(Math.max(1, Number(event.target.value) || 1))} /><button className="btn secondary" disabled={cashAmount > state.player.cash || available.cash + cashAmount > 300} onClick={() => dispatch({ type: "NIGHT_OWL_STASH_CASH", direction: "store", amount: cashAmount })}>Store cash</button><button className="btn secondary" disabled={cashAmount > available.cash} onClick={() => dispatch({ type: "NIGHT_OWL_STASH_CASH", direction: "retrieve", amount: cashAmount })}>Retrieve</button></div>}
    {(stash.mode === null || stash.mode === "product") && <div className="btn-row">{C.PRODUCTS.map((product) => <React.Fragment key={product.id}>{state.player.inventory[product.id].qty > 0 && available.product < 3 && <button className="btn secondary" onClick={() => dispatch({ type: "NIGHT_OWL_STASH_PRODUCT", direction: "store", productId: product.id, qty: 1 })}>Store 1 {product.name}</button>}{stash.inventory[product.id].qty > 0 && <button className="btn secondary" onClick={() => dispatch({ type: "NIGHT_OWL_STASH_PRODUCT", direction: "retrieve", productId: product.id, qty: 1 })}>Take 1 {product.name}</button>}</React.Fragment>)}</div>}
  </div>;
}

function JobDetail({ state, dispatch, job, onBack }) {
  const record = state.jobs.records[job.id];
  const availability = C.selectors.jobAvailability(state, job.id);
  const pay = C.selectors.jobPayRange(state, job.id);
  const slots = job.id === "night_owl" && record.rank >= 1 ? [2, 3] : job.slots;
  return <><PageHead title={job.name} sub={`${money(pay.min)}–${money(pay.max)} · ${slots.map((slot) => C.SLOTS[slot]).join(" / ")} · Risk: ${job.risk}`} onBack={onBack} /><div className="scroll">
    <div className={`card${availability.available ? "" : " locked"}`}><div className="card-title">Rank {record.rank}<small>{record.xp}/14 XP</small></div><p className="compact">{job.scheduled ? "One scheduled job shift per day across Spenard." : "Occasional gig · separate from the scheduled-job limit."}</p><p className="muted compact">{availability.reason}</p></div>
    {!job.dayLabor && state.jobs.activeJobId !== job.id ? state.jobs.offers.includes(job.id) ? <div className="card cleared-card"><div className="card-title">Job offer<small>WAITING</small></div><p>Accepting quits the current employer. That employer's XP, rank, and coworker relationship reset; discovered people and history remain.</p><div className="btn-row"><button className="btn primary" onClick={() => dispatch({ type: "ACCEPT_JOB", jobId: job.id })}>Accept offer<span className="action-copy">Free · activates this employer</span></button><button className="btn secondary" onClick={() => dispatch({ type: "DECLINE_JOB", jobId: job.id })}>Decline</button></div></div> : <button className="btn full primary" disabled={!state.phone.active || state.jobs.applications.some((item) => item.jobId === job.id)} onClick={() => dispatch({ type: "APPLY_JOB", jobId: job.id })}>Apply for this job<span className="action-copy">{!state.phone.active ? "Phone service is required for the callback" : state.jobs.applications.some((item) => item.jobId === job.id) ? "Waiting on the callback" : "Uses one part of day · callback becomes an explicit offer"}</span></button> : <>
      <div className="section-label">Choose a shift approach</div>
      {Object.values(C.JOB_APPROACHES).map((approach) => <button className="btn full secondary" key={approach.id} disabled={!availability.available} onClick={() => dispatch({ type: "WORK_JOB", jobId: job.id, approach: approach.id })}>{approach.label}<span className="action-copy">{approach.description} · one part of day</span></button>)}
    </>}
    {job.coworkers.filter((person) => record.coworkersMet.includes(person.id)).map((person) => { const relationship = state.contacts[person.id]?.relationshipLevel || 0; return <div className="card" key={person.id}><div className="card-title">{person.name}<small>{C.selectors.relationshipLabel(relationship).toUpperCase()}</small></div><p className="compact">Workplace relationship {relationship} · {record.shifts} shift{record.shifts === 1 ? "" : "s"} completed.</p>{job.id === "night_owl" && record.rank >= 3 && <p className="good compact">Deshawn's Spenard vouch is active.</p>}</div>; })}
    {job.id === "night_owl" && <NightOwlStash state={state} dispatch={dispatch} />}
  </div></>;
}

function SocialContacts({ state, dispatch, navigateMore }) {
  const [openId, setOpenId] = useState(null);
  const personal = C.selectors.personalContacts(state);
  const contacts = C.selectors.knownSocialContacts(state);
  const personalCards = personal.map((person) => {
    const open = openId === `personal:${person.id}`;
    const present = C.selectors.householdPresence(state) === person.id;
    return <div className="card contact-card" key={`personal:${person.id}`}>
      <button className="contact-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : `personal:${person.id}`)}><span><b>{person.name}</b><small>{person.role}</small></span><span>{person.status}</span></button>
      {open && <ExpandableMoreSection collapsedContent={<p className="compact">{person.summary}</p>} expandedContent={<div className="contact-actions">
        {["yalonda", "juan"].includes(person.id) && <button className="btn secondary" disabled={!present || state.people.household.lastQuestionDay === state.run.day} onClick={() => dispatch({ type: "TALK_HOUSEHOLD", npcId: person.id })}>Talk<span className="action-copy">{present ? "Free · once daily" : "Not home now"}</span></button>}
        {person.id === "mina" && <button className="btn secondary" onClick={() => dispatch({ type: "VISIT_MINA" })}>Talk with Mina<span className="action-copy">Free at Night Owl during Evening or Night</span></button>}
        {person.id === "dre" && navigateMore && <button className="btn secondary" onClick={navigateMore}>Open Finances</button>}
      </div>} />}
    </div>;
  });
  const socialCards = contacts.filter((person) => !["yalonda", "juan"].includes(person.id)).map((person) => {
    const open = openId === person.id;
    const call = C.selectors.contactAvailability(state, person.id, "call");
    const text = C.selectors.contactAvailability(state, person.id, "text");
    const visit = C.selectors.contactAvailability(state, person.id, "visit");
    return <div className="card contact-card" key={person.id}>
      <button className="contact-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : person.id)}><span><b>{person.name}</b><small>{person.role}</small></span><span>{person.relationshipLabel} · Level {person.relationshipLevel}</span></button>
      {open && <div className="contact-actions">
        {[['call', 'Call', call], ['text', 'Text', text], ['visit', 'Visit', visit]].map(([type, label, access]) => <button className="btn secondary" key={type} disabled={!access.available} onClick={() => dispatch({ type: `CONTACT_${type.toUpperCase()}`, npcId: person.id })}>{label}<span className="action-copy">{access.reason}</span></button>)}
      </div>}
    </div>;
  });
  return <><div className="section-label">Personal</div>{personalCards}<div className="section-label">Social</div>{socialCards.length ? socialCards : <div className="card locked"><p className="compact muted">Work shifts and late-night conversations add people here.</p></div>}</>;
}

function GymCard({ state, dispatch }) {
  const gym = C.selectors.activityAvailability(state).gym;
  return <div className="card"><div className="card-title">Spenard Community Gym<small>{money(gym.cost)} · +{gym.progress} progress</small></div><p className="compact">{state.memberships.gym ? "Membership active." : "$30 first membership plus today's session."} Training uses one part of day.</p><div className="btn-row">{[["strength", "Strength"], ["endurance", "Endurance"], ["reflexes", "Reflexes"]].map(([id, label]) => <button className="btn secondary" key={id} disabled={!gym.available || state.player.attributes[id] >= 5} onClick={() => dispatch({ type: "TRAIN_ATTRIBUTE", attribute: id })}>{label} {state.player.attributes[id]}</button>)}</div><p className="muted compact">Session {gym.sessionsToday + 1} today · cost {money(gym.cost)} · one part of day</p></div>;
}

function ExploreSpenard({ state, dispatch, page, setPage, onBack }) {
  const jobs = C.selectors.discoveredJobs(state);
  const contacts = C.selectors.knownSocialContacts(state);
  const nightOwl = C.selectors.districtActionAvailability(state, "night_owl");
  const closedNightOwlPage = page === "nightowl" && !nightOwl.available;
  const effectivePage = closedNightOwlPage ? "places" : page;
  useEffect(() => { if (closedNightOwlPage) setPage("places"); }, [closedNightOwlPage]);
  if (page.startsWith("job:")) { const job = C.SPENARD_JOBS.find((item) => item.id === page.split(":")[1]); return <JobDetail state={state} dispatch={dispatch} job={job} onBack={() => setPage("jobs")} />; }
  if (effectivePage === "nightowl") return <NightOwlHub state={state} dispatch={dispatch} onBack={() => setPage("places")} />;
  if (effectivePage === "jobs") return <><PageHead title="Spenard Jobs" sub="Found work still requires an application and callback" onBack={() => setPage("activities")} /><div className="scroll">{jobs.map((job) => { const record = state.jobs.records[job.id]; const pay = C.selectors.jobPayRange(state, job.id); const availability = C.selectors.jobAvailability(state, job.id); const slots = job.id === "night_owl" && record.rank >= 1 ? [2, 3] : job.slots; return <MenuRow key={job.id} title={job.name} status={`${money(pay.min)}–${money(pay.max)}`} description={`${slots.map((slot) => C.SLOTS[slot]).join(" / ")} · Risk: ${job.risk} · Rank ${record.rank} · ${availability.available ? "Available" : availability.reason}`} tone={availability.available ? "" : "muted"} onClick={() => setPage(`job:${job.id}`)} />; })}</div></>;
  if (effectivePage === "contacts") return <><PageHead title="Contacts" sub="Personal and social contacts in one place" onBack={() => setPage("activities")} /><div className="scroll"><SocialContacts state={state} dispatch={dispatch} /></div></>;
  if (effectivePage === "places") return <><PageHead title="Places" sub="Specific doors in Spenard" onBack={() => setPage("root")} /><div className="scroll">
    <MenuRow title="Night Owl" status={nightOwl.available ? "Open" : nightOwl.reason} description="Coffee, community board, Mina, regulars, and a counter job." disabled={!nightOwl.available} onClick={() => setPage("nightowl")} />
    {state.discovered.spenardGym && <GymCard state={state} dispatch={dispatch} />}
    <div className="card"><div className="card-title">Phone Store<small>WALK-IN</small></div><p className="compact">Pay in person even after service shuts off.</p><button className="btn full primary" disabled={state.run.day < state.phone.billDueDay || state.player.cash < C.PHONE_BILL} onClick={() => dispatch({ type: "PAY_PHONE_BILL", surface: "store" })}>Pay phone bill · {money(C.PHONE_BILL)}<span className="action-copy">Free · no time passes</span></button></div>
  </div></>;
  if (effectivePage === "activities") return <><PageHead title="Activities" sub="Work, wandering, and people" onBack={() => setPage("root")} /><div className="scroll">
    <MenuRow title="Wander" status={`${state.world.locations.explorationCount} walks`} description="Walk around, discover work, and see what happens." onClick={() => dispatch({ type: "WANDER_SPENARD" })} />
    <MenuRow title="Jobs" status={`${jobs.length} found`} description="Applications, callbacks, and available shifts." onClick={() => setPage("jobs")} />
    <MenuRow title="Contacts" status={`${C.selectors.personalContacts(state).length + contacts.length} known`} description="Personal and social contacts." onClick={() => setPage("contacts")} />
  </div></>;
  return <><PageHead title="Explore Spenard" sub="Learn what the neighborhood has to offer" onBack={onBack} /><div className="scroll">
    <MenuRow title="Places" status={state.discovered.spenardGym ? "3 known" : "2 known"} description="Night Owl, community gym, and phone store." onClick={() => setPage("places")} />
    <MenuRow title="Activities" status={`${jobs.length} jobs`} description="Wander, Jobs, and Contacts." onClick={() => setPage("activities")} />
  </div></>;
}

function NightOwlHub({ state, dispatch, onBack }) {
  const board = C.selectors.nightOwlBoardItems(state);
  const present = C.selectors.nightOwlRegularFor(state);
  const regular = state.nightOwl.regulars[present.id];
  const viewed = state.nightOwl.boardViewedDays.includes(state.run.day);
  const nightJob = state.jobs.discovered.includes("night_owl");
  const boardAccess = C.selectors.districtActionAvailability(state, "night_owl_board");
  const coffeeAccess = C.selectors.districtActionAvailability(state, "night_owl_coffee");
  const regularAccess = C.selectors.districtActionAvailability(state, "night_owl_regular");
  const visitAccess = C.selectors.districtActionAvailability(state, "night_owl_visit");
  return <><PageHead title="Night Owl" sub="Coffee, a community board, and people who keep late hours" onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">Coffee<small>$4</small></div><p className="compact">A hot cup is immediate and restores one point of the reserve that keeps you moving.</p><button className="btn full primary" disabled={!coffeeAccess.available} onClick={() => dispatch({ type: "BUY_COFFEE" })}>Buy coffee · $4<span className="action-copy">{coffeeAccess.available ? "Free · restores reserve" : coffeeAccess.reason}</span></button></div>
    <div className="card"><div className="card-title">Community board<small>{viewed ? "VIEWED TODAY" : "FREE DAILY"}</small></div>{viewed ? <div className="detail-list">{board.map((entry) => <span key={entry.id}><b>{entry.title}:</b> {entry.body}</span>)}</div> : <p className="compact">Three postings rotate each day. Reading them costs no time.</p>}<button className="btn full secondary" disabled={!boardAccess.available} onClick={() => dispatch({ type: "VIEW_NIGHT_OWL_BOARD" })}>{viewed ? "Read today's postings" : "Check the board"}<span className="action-copy">{boardAccess.available ? "Free · no time passes" : boardAccess.reason}</span></button>{viewed && board.some((entry) => entry.id === "laptop") && !state.inventory.laptop && <button className="btn full primary" disabled={state.player.cash < 250} onClick={() => dispatch({ type: "BUY_LAPTOP" })}>Buy used laptop · $250<span className="action-copy">Adds five daily Home listings</span></button>}</div>
    <div className="card"><div className="card-title">{present.name}<small>{present.role.toUpperCase()}</small></div><p className="compact">{present.hint}</p><p className="muted compact">Relationship {regular.relationship} · {regular.met ? "Met" : "New face"}</p><button className="btn full secondary" disabled={!regularAccess.available || regular.lastTalkDay === state.run.day} onClick={() => dispatch({ type: "TALK_NIGHT_OWL_REGULAR", regularId: present.id })}>Talk with {present.name.split(" ")[0]}<span className="action-copy">{!regularAccess.available ? regularAccess.reason : regular.lastTalkDay === state.run.day ? "Already talked today" : "One part of day"}</span></button></div>
    <div className="card"><div className="card-title">Mina Vale<small>{state.npc.mina.met ? state.npc.mina.status.toUpperCase() : "AT THE REGISTER"}</small></div><p className="compact">{state.npc.mina.met ? "Mina remembers the tone of your first conversation." : "The clerk watches the counter and lets new customers decide how to begin."}</p><button className="btn full secondary" disabled={!visitAccess.available} onClick={() => dispatch({ type: "VISIT_NIGHT_OWL" })}>{state.npc.mina.met ? "Talk with Mina" : "Introduce yourself"}<span className="action-copy">{visitAccess.available ? "One part of day" : visitAccess.reason}</span></button></div>
    {nightJob && <div className="card"><div className="card-title">Night Owl job<small>RANK {state.jobs.records.night_owl.rank}</small></div><p className="compact">The counter shift, Rank 2 stash, and Rank 3 Deshawn vouch remain part of the job track.</p></div>}
    <NightOwlStash state={state} dispatch={dispatch} />
  </div></>;
}

function ReturnToSpenardActions({ state, dispatch }) {
  if (state.world.currentNeighborhoodId === C.HOME_DISTRICT_ID) return null;
  const ride = C.selectors.districtActionAvailability(state, "return_spenard");
  const walk = C.selectors.districtActionAvailability(state, "walk_spenard");
  return <div className="return-actions">
    <button className="btn full primary" disabled={!ride.available} onClick={() => dispatch(C.DISTRICT_ACTIONS.return_spenard.action)}>Return to Spenard<span className="action-copy">{ride.available ? `${ride.cashCost ? "$5 fare" : "Pass covers fare"} · one part of day` : ride.reason}</span></button>
    {walk.visible && <button className="btn full secondary" onClick={() => dispatch(C.DISTRICT_ACTIONS.walk_spenard.action)}>Walk back<span className="action-copy">$0 · two parts of day · −3 Health</span></button>}
  </div>;
}

// What can I do without leaving? The registry filters local actions before
// this page renders them; reducer preflight enforces the same boundary.
function AroundHere({ state, dispatch, onBack, initialPage = "root" }) {
  const [gambleApproach, setGambleApproach] = useState("read");
  const [page, setPage] = useState(initialPage);
  const available = C.selectors.activityAvailability(state);
  const area = areaOf(state);
  const actions = C.selectors.aroundActions(state);
  const actionOf = (id) => actions.find((entry) => entry.id === id);
  const staleLocalPage = area.id !== C.HOME_DISTRICT_ID && page !== "root";
  const effectivePage = staleLocalPage ? "root" : page;
  useEffect(() => { if (effectivePage !== page) setPage("root"); }, [effectivePage, page]);
  if (effectivePage === "intel") return <LocalIntel state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (effectivePage !== "root") return <ExploreSpenard state={state} dispatch={dispatch} page={effectivePage} setPage={setPage} onBack={() => setPage("root")} />;
  const localActions = actions.filter((entry) => !["return_spenard", "walk_spenard"].includes(entry.id));
  return <><PageHead title={`Around ${area.name}`} sub="What you can do without leaving the neighborhood" onBack={onBack} /><div className="scroll">
    <ReturnToSpenardActions state={state} dispatch={dispatch} />
    {actionOf("explore_spenard") && <MenuRow title="Explore Spenard" status={state.world.locations.explorationCount ? `${state.world.locations.explorationCount} walks` : "New arrival"} description="Jobs, wandering, and people you meet through work." onClick={() => setPage("explore")} />}
    {actionOf("local_intel") && <MenuRow title="Local Intel" status={`${state.world.locations.explorationCount} walks`} description="Routes, discoveries, and word collected around Spenard." onClick={() => setPage("intel")} />}
    {actionOf("spenard_gambling") && <div className={`card${available.gambling.available ? "" : " locked"}`}><div className="card-title">Informal Game<small>EVENING / NIGHT</small></div><p className="compact">Choose an approach, then risk $20, $50, or $100. Attributes inform the seeded result but never guarantee profit. No debt is offered.</p><select aria-label="Gambling approach" value={gambleApproach} onChange={(event) => setGambleApproach(event.target.value)}><option value="read">Read the room · Insight</option><option value="steady">Play disciplined · Discipline</option><option value="press">Work the table · Presence</option></select><div className="btn-row">{[20, 50, 100].map((stake) => <button className="btn secondary" key={stake} disabled={!available.gambling.available || state.player.cash < stake} onClick={() => dispatch({ type: "GAMBLE", stake, approach: gambleApproach })}>Risk ${stake}</button>)}</div><p className="muted compact">{available.gambling.reason}</p></div>}
    {area.id === "downtown" && <div className="card"><div className="card-title">Downtown<small>EARLY SCAFFOLD</small></div><p className="compact muted">No local jobs, people, or activities are available here yet.</p></div>}
    {!localActions.length && area.id !== "downtown" && <div className="card locked"><div className="card-title">No local actions</div><p className="compact muted">Only the route back to Spenard is available here.</p></div>}
  </div></>;
}

// The spare room: storage, house rules, and sleep.
function Household({ state, dispatch, onBack }) {
  const [homeCash, setHomeCash] = useState(100);
  const storedProducts = C.PRODUCTS.reduce((total, product) => total + state.home.storedInventory[product.id].qty, 0);
  const carriedWeapon = C.GEAR.find((item) => item.slot === "weapon" && state.player.gear.owned.includes(item.id));
  const present = C.selectors.householdPresence(state);
  if (state.world.currentNeighborhoodId !== C.HOME_DISTRICT_ID) return <><PageHead title="Home" sub="Yalonda's spare room is back in Spenard" onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Return home<small>SPENARD</small></div><p className="compact">Storage, Yalonda, Juan, and sleep are available once you get back.</p><ReturnToSpenardActions state={state} dispatch={dispatch} /></div></div></>;
  return <><PageHead title="Yalonda's Home" sub="A weekly room with house rules" onBack={onBack} /><div className="scroll">
    <div className={`card${state.people.household.evicted ? " locked" : ""}`}><div className="card-title">House standing<small>{state.people.household.evicted ? "EVICTED" : `${state.people.household.warnings}/3 WARNINGS`}</small></div><p className="compact">Cash is safe here; contraband is not. The room holds at most two product units and one concealable weapon.</p>
      <div className="outcome-grid"><Outcome label="Stored cash" value={money(state.home.storedCash)} /><Outcome label="Stored product" value={`${storedProducts}/2`} /><Outcome label="Hidden weapon" value={state.home.hiddenWeapon ? (C.GEAR.find((item) => item.id === state.home.hiddenWeapon)?.name || state.home.hiddenWeapon) : "None"} /><Outcome label="At home" value={present === "yalonda" ? "Yalonda" : present === "juan" ? "Juan" : "Nobody"} /></div>
    </div>
    <div className="section-label">Storage</div>
    <div className="card">
      <div className="field-row"><input aria-label="Home cash amount" type="number" min="1" value={homeCash} onChange={(event) => setHomeCash(Math.max(1, Number(event.target.value) || 1))} /><button className="btn secondary" disabled={state.people.household.evicted || homeCash > state.player.cash} onClick={() => dispatch({ type: "HOME_STORE_CASH", amount: homeCash })}>Store cash</button><button className="btn secondary" disabled={state.people.household.evicted || homeCash > state.home.storedCash} onClick={() => dispatch({ type: "HOME_RETRIEVE_CASH", amount: homeCash })}>Retrieve</button></div>
      <div className="btn-row">{C.PRODUCTS.map((product) => <React.Fragment key={product.id}>{state.player.inventory[product.id].qty > 0 && storedProducts < 2 && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_STORE_PRODUCT", productId: product.id, qty: 1 })}>Hide 1 {product.name}</button>}{state.home.storedInventory[product.id].qty > 0 && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_RETRIEVE_PRODUCT", productId: product.id, qty: 1 })}>Take 1 {product.name}</button>}</React.Fragment>)}</div>
      <div className="btn-row">{carriedWeapon && !state.home.hiddenWeapon && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_HIDE_WEAPON", gearId: carriedWeapon.id })}>Hide {carriedWeapon.name}</button>}{state.home.hiddenWeapon && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_RETRIEVE_WEAPON" })}>Take hidden weapon</button>}</div>
    </div>
    {present && <button className="btn full secondary" disabled={state.people.household.evicted || state.people.household.lastQuestionDay === state.run.day} onClick={() => dispatch({ type: "TALK_HOUSEHOLD", npcId: present })}>Talk with {present === "yalonda" ? "Yalonda" : "Juan"}<span className="action-copy">{state.people.household.lastQuestionDay === state.run.day ? "Already talked today" : "Free · once daily"}</span></button>}
    {state.run.day >= state.obligations.rentDueDay && <button className="btn full secondary" disabled={state.player.cash < C.WEEKLY_RENT} onClick={() => dispatch({ type: "PAY_RENT" })}>Pay rent · {money(C.WEEKLY_RENT)}<span className="action-copy">No time passes</span></button>}
    <button className="btn full primary" disabled={state.people.household.evicted} onClick={() => dispatch({ type: "SLEEP_HOME" })}>Sleep at home<span className="action-copy">$0 · uses one part of day</span></button>
  </div></>;
}

// Exploration stores discovery ids; the player never sees an id.
const DISCOVERY_LABELS = { goodie_supplier: "A supplier holding weight on a Spenard corner.", informal_game: "An informal card game that runs evenings and nights." };
// What the run has actually taught the player about the city.
function LocalIntel({ state, dispatch, onBack }) {
  const discoveries = state.world.locations.discoveries || [];
  return <><PageHead title="Local Intel" sub="Routes, discoveries, and what the street is saying" onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">Known routes<small>{[state.world.transport.downtownKnown, state.world.transport.industrialRouteKnown].filter(Boolean).length + 1}/3</small></div>
      <div className="detail-list">
        <span><b>Spenard:</b> home ground.</span>
        <span><b>Downtown:</b> {state.world.transport.downtownKnown ? "ridden and mapped." : "one bus ride away, still unseen."}</span>
        <span><b>Industrial Service Roads:</b> {state.world.transport.industrialRouteKnown ? "a trusted route is open." : "no way in yet."}</span>
      </div>
    </div>
    <div className="card"><div className="card-title">Walks taken<small>{state.world.locations.explorationCount}</small></div>{discoveries.length ? <div className="detail-list">{discoveries.map((entry, index) => <span key={index}>{DISCOVERY_LABELS[entry] || "A local detail worth remembering."}</span>)}</div> : <p className="muted compact">Nothing found yet. Walking Spenard is how the neighborhood opens up.</p>}</div>
  </div></>;
}

// Property. Only reachable while there is still something to acquire.
function Listings({ state, dispatch, onBack }) {
  return <><PageHead title="Listings" sub="Property and counters you can look at before you commit" onBack={onBack} /><div className="scroll">
    <PlaceAction title="North Star Garage Listing" status={state.base.controlled ? "CONTROLLED" : `$${C.GARAGE_DEPOSIT} DEPOSIT`} purpose="Lease-to-control property; storage, upgrades, crew operations, and recovery unlock after acquisition." cost={state.base.controlled ? "Paid" : money(C.GARAGE_DEPOSIT)} time={state.base.controlled ? "Browsing is free" : "Leasing uses one part of day"} disabled={state.base.controlled || state.player.cash < C.GARAGE_DEPOSIT} reason={state.base.controlled ? "Already controlled." : state.player.cash < C.GARAGE_DEPOSIT ? `You need ${money(C.GARAGE_DEPOSIT - state.player.cash)} more.` : "Deposit and first week included; future rent is documented, not charged in this build."} onClick={() => dispatch({ type: "LEASE_GARAGE" })} />
    <PlaceAction title="Auto Lot" status="BROWSE ONLY" purpose="See what future vehicle ownership could change." cost="$0" time="Free information" disabled={true} reason="Vehicle ownership is deferred." />
    <PlaceAction title="Gun Counter" status="BROWSE ONLY" purpose="Review legal firearm options without buying." cost="$0" time="Free information" disabled={true} reason="Purchasing is deferred pending combat balance." />
  </div></>;
}

function NineOhSevenList({ state, dispatch, onBack, surface = "phone" }) {
  const atHome = (surface === "home" || !state.phone.active) && state.inventory.laptop && state.world.currentNeighborhoodId === "north_star_lot";
  const slate = C.selectors.listingSlate(state, atHome ? "home" : "phone");
  const list = state.nineZeroSevenList;
  return <><PageHead title="907List" sub={atHome ? "Five listings refresh daily on the laptop" : "Three listings refresh every two days on your phone"} onBack={onBack} /><div className="scroll">
    {state.run.day >= state.phone.billDueDay && <div className="card debt-card"><div className="card-title">Phone bill<small>{money(C.PHONE_BILL)} DUE</small></div><p className="compact">Online payment needs the laptop and active service. A dead phone must be paid at the store.</p><button className="btn full primary" disabled={!state.inventory.laptop || !state.phone.active || state.player.cash < C.PHONE_BILL} onClick={() => dispatch({ type: "PAY_PHONE_BILL", surface: "online" })}>Pay online · {money(C.PHONE_BILL)}<span className="action-copy">Free · no time passes</span></button></div>}
    <div className="stat-row"><StatTile label="Held" value={`${list.inventory.length}/${C.LISTING_CAPACITY}`} /><StatTile label="Sales" value={list.sales} /><StatTile label="Profit" value={money(list.profit)} tone={list.profit >= 0 ? "good" : "bad"} /></div>
    {!state.inventory.laptop && <div className="card"><div className="card-title">Used laptop<small>$250</small></div><p className="compact">Unlock five listings that refresh each day from Home.</p><button className="btn full primary" disabled={state.player.cash < 250} onClick={() => dispatch({ type: "BUY_LAPTOP" })}>Buy laptop · $250<span className="action-copy">One-time purchase · no alert matching</span></button></div>}
    <div className="section-label">Today's listings</div>
    {slate.map((item) => <div className="card" key={item.id}><div className="card-title">{item.name}<small>{money(item.buy)}</small></div><div className="outcome-grid"><Outcome label="Est. resale" value={`${money(item.resale[0])}–${money(item.resale[1])}`} /><Outcome label="Est. profit" value={`${money(item.resale[0] - item.buy)}–${money(item.resale[1] - item.buy)}`} /></div><button className="btn full secondary" disabled={list.inventory.length >= C.LISTING_CAPACITY || state.player.cash < item.buy} onClick={() => dispatch({ type: "BUY_907LIST", itemId: item.id, surface: atHome ? "home" : "phone" })}>Buy for {money(item.buy)}<span className="action-copy">Free transaction · held until resold</span></button></div>)}
    {list.inventory.length > 0 && <><div className="section-label">Held items</div>{list.inventory.map((held) => { const item = C.LISTING_ITEMS.find((entry) => entry.id === held.itemId); return <div className="card" key={held.id}><div className="card-title">{item.name}<small>BOUGHT {money(held.cost)}</small></div><p className="compact">Expected buyer range {money(item.resale[0])}–{money(item.resale[1])}.</p><button className="btn full primary" onClick={() => dispatch({ type: "SELL_907LIST", inventoryId: held.id, surface: atHome ? "home" : "phone" })}>Find a buyer<span className="action-copy">Free transaction · proceeds are clean cash</span></button></div>; })}</>}
    <div className="section-label">Aspirational property</div>
    <PlaceAction title="North Star Garage" status={state.base.controlled ? "CONTROLLED" : "$650 DEPOSIT"} purpose="Storage and operations space. This property never occupies a 907List inventory slot." cost={state.base.controlled ? "Paid" : "$650"} time={state.base.controlled ? "Owned" : "Leasing uses one part of day"} disabled={state.base.controlled || state.player.cash < C.GARAGE_DEPOSIT} reason={state.base.controlled ? "Already controlled." : state.player.cash < C.GARAGE_DEPOSIT ? `You need ${money(C.GARAGE_DEPOSIT - state.player.cash)} more.` : "Deposit and first week included."} onClick={() => dispatch({ type: "LEASE_GARAGE" })} />
  </div></>;
}

function Travel({ state, dispatch, setTab, page, setPage }) {
  if (page === "destinations") return <Destinations state={state} dispatch={dispatch} setTab={setTab} onBack={() => setPage("root")} />;
  if (page === "around" || page.startsWith("around:")) return <AroundHere state={state} dispatch={dispatch} onBack={() => setPage("root")} initialPage={page.startsWith("around:") ? page.slice("around:".length) : "root"} />;
  if (page === "household") return <Household state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  const covered = state.world.transport.weekPass || state.world.transport.dayPassDay === state.run.day;
  const area = areaOf(state);
  const shift = C.selectors.quickShift(state);
  return <><PageHead title="Travel" sub="Where to go, how to get there, and what is around you" /><div className="scroll">
    {shift && <button className={`quick-shift${shift.available ? "" : " locked"}`} disabled={!shift.available} onClick={() => setPage(`around:job:${shift.jobId}`)}>
      <span className="quick-shift-main"><b>{shift.name} shift</b><small>{shift.available ? `${money(shift.pay.min)}–${money(shift.pay.max)} · one part of day` : shift.reason}</small></span>
      <span className="quick-shift-go" aria-hidden="true">›</span>
    </button>}
    <MenuRow title={`Around ${area.name}`} status={state.world.currentNeighborhoodId === C.HOME_DISTRICT_ID ? "You are here" : "Return route ready"} description={state.world.currentNeighborhoodId === C.HOME_DISTRICT_ID ? "Explore Places and Activities, gamble, or check Local Intel." : "Local actions and the route back to Spenard."} onClick={() => setPage("around")} />
    <MenuRow title="Home" status={state.world.currentNeighborhoodId === C.HOME_DISTRICT_ID ? `${state.people.household.warnings}/3 warnings` : covered ? "Pass covers return" : "$5 return"} description="Storage, Yalonda, Juan, and sleep." disabled={state.people.household.evicted} onClick={() => setPage("household")} />
    <MenuRow title="Leave Spenard" status={state.world.transport.weekPass ? "7-day pass" : covered ? "Day pass" : "$5 a ride"} description="Known non-Spenard destinations and pass controls." onClick={() => setPage("destinations")} />
  </div></>;
}

function StreetScreen({ state, dispatch, page, setPage, onTrade }) {
  if (page === "people") return <People state={state} dispatch={dispatch} navigateMore={() => setPage("root")} />;
  if (page === "market") return <Market state={state} onTrade={onTrade} />;
  if (page.startsWith("travel:")) return <Travel state={state} dispatch={dispatch} setTab={() => {}} page={page.slice(7)} setPage={(next) => setPage(`travel:${next}`)} />;
  const area = areaOf(state);
  return <><PageHead title="Street" sub="Destinations, local places, activities, and people" /><div className="scroll">
    <MenuRow title={`Around ${area.name}`} status="Places & activities" description="Travel, explore, work, train, and handle local business." onClick={() => setPage("travel:root")} />
    <MenuRow title="People" status={`${C.selectors.personalContacts(state).length} personal contacts`} description="Contacts, street suppliers, crew, and relationship history." onClick={() => setPage("people")} />
    {!state.hustle.visible && state.market.visible && <MenuRow title="Street Market" status="Discovered" description="Buy and make the first sale here. Hustle unlocks after dirty income lands." onClick={() => setPage("market")} />}
  </div></>;
}

function SharkPanel({ state, dispatch }) {
  const [borrowerId, setBorrowerId] = useState("nora");
  const [amount, setAmount] = useState(100);
  const [term, setTerm] = useState(2);
  const readiness = C.selectors.sharkLoanAvailability(state, borrowerId, amount, term);
  return <div className="scroll">
    <div className="card"><div className="card-title">New borrower note<small>{readiness.risk || "QUALITATIVE RISK"}</small></div>
      <label>Borrower<select value={borrowerId} onChange={(event) => setBorrowerId(event.target.value)}>{C.SHARK_BORROWERS.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.riskLabel}</option>)}</select></label>
      <div className="btn-row">{[100, 250, 500].map((value) => <button key={value} className={`btn secondary${amount === value ? " active" : ""}`} onClick={() => setAmount(value)}>{money(value)}</button>)}</div>
      <div className="btn-row">{[2, 4, 7].map((value) => <button key={value} className={`btn secondary${term === value ? " active" : ""}`} onClick={() => setTerm(value)}>{value} days · {Math.round(C.SHARK_TERMS[value] * 100)}%</button>)}</div>
      <button className="btn full primary" disabled={!readiness.available} onClick={() => dispatch({ type: "FUND_SHARK", borrowerId, amount, term })}>Fund {money(amount)}<span className="action-copy">{readiness.available ? `${readiness.risk} risk · free transaction` : readiness.reason}</span></button>
    </div>
    {state.hustle.shark.loans.map((loan) => { const person = C.SHARK_BORROWERS.find((item) => item.id === loan.borrowerId); return <div className="card" key={loan.id}><div className="card-title">{person.name}<small>{loan.status.toUpperCase()}</small></div><p>{money(loan.amount)} · due Day {loan.dueDay} · displayed risk {loan.risk}</p>{loan.status === "defaulted" && <div className="btn-row"><button className="btn secondary" onClick={() => dispatch({ type: "COLLECT_SHARK", loanId: loan.id })}>Collect</button><button className="btn secondary" onClick={() => dispatch({ type: "EXTEND_SHARK", loanId: loan.id })}>Extend</button><button className="btn primary" onClick={() => dispatch({ type: "ENFORCE_SHARK", loanId: loan.id })}>Enforce</button><button className="btn ghost" onClick={() => dispatch({ type: "FORGIVE_SHARK", loanId: loan.id })}>Forgive</button></div>}</div>; })}
  </div>;
}

function HustleScreen({ state, dispatch, page, setPage, onTrade }) {
  if (!state.hustle.visible && page !== "market") return <><PageHead title="Hustle" sub="Illegal-income work stays off the rail until it exists" /><div className="scroll"><div className="card locked"><div className="card-title">No hustle yet<small>LOCKED</small></div><p>Complete the first dirty-income action. A discovered street market remains available through Street.</p></div></div></>;
  if (page === "market") return <Market state={state} onTrade={onTrade} />;
  if (page === "boost") return <Boost state={state} dispatch={dispatch} />;
  if (page === "stickup") return <Rob state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "shark") return <><PageHead title="Shark" sub="Borrower profiles, qualitative risk, and open notes" onBack={() => setPage("root")} /><SharkPanel state={state} dispatch={dispatch} /></>;
  return <><PageHead title="Hustle" sub="Illegal-income work in one place" /><div className="scroll">
    <div className="card"><div className="card-title">Curtis Foyer<small>ATTENTION {state.npc.curtis.attention}/8</small></div><p>Respect {state.npc.curtis.respect} · {state.npc.curtis.relationship}. Attention comes from visible sales, rolling illegal revenue, reports, and network escalation.</p>{state.npc.curtis.attention >= 4 && !state.npc.curtis.friendship && !state.npc.curtis.taxActive && <div className="btn-row"><button className="btn secondary" onClick={() => dispatch({ type: "CURTIS_DECISION", choice: "pay_tax" })}>Pay tax</button><button className="btn secondary" onClick={() => dispatch({ type: "CURTIS_DECISION", choice: "friendship" })}>Friendship</button><button className="btn secondary" onClick={() => dispatch({ type: "CURTIS_DECISION", choice: "guarded" })}>Stay guarded</button><button className="btn primary" onClick={() => dispatch({ type: "CURTIS_DECISION", choice: "reject" })}>Reject</button></div>}</div>
    {state.market.visible && <MenuRow title="Market" status={`${state.hustle.soldUnits} units sold`} description="Buy, sell, and finish a market session." onClick={() => setPage("market")} />}
    {state.boost.visible && <MenuRow title="Boost" status={`Tier ${state.boost.tier}`} description="Store work, targets, and the fence." onClick={() => setPage("boost")} />}
    {state.rob.visible && <MenuRow title="Stickup" status={`${state.stats.robbery.successes} successes`} description="Direct robbery attempts and their consequences." onClick={() => setPage("stickup")} />}
    {state.hustle.shark.visible && <MenuRow title="Shark" status={`${state.hustle.shark.loans.filter((loan) => ["active", "extended", "defaulted"].includes(loan.status)).length} open`} description="Fund borrowers and resolve defaults." onClick={() => setPage("shark")} />}
    {!state.market.visible && !state.boost.visible && !state.rob.visible && !state.hustle.shark.visible && <div className="card locked">Sections unlock independently as the run discovers them.</div>}
  </div></>;
}

function SpenardBlockCard({ state, dispatch, block }) {
  const record = state.world.territoryBlocks[block.id]; const revealed = C.selectors.blockIntelVisible(state); const claim = C.selectors.blockClaimAvailability(state, block.id); const soldiers = C.selectors.blockSoldierCount(state, block.id);
  if (record.owner === "player") return <div className="card cleared-card"><div className="card-title">{block.name}<small>CONTROLLED</small></div><p className="compact">{soldiers} soldier{soldiers === 1 ? "" : "s"} posted · {money(record.incomeCollected)} collected so far.</p>{record.lastRaidDay != null && <p className="warn compact">Last raided Day {record.lastRaidDay} · {record.raidCount} raid{record.raidCount === 1 ? "" : "s"} total.</p>}</div>;
  return <div className="card debt-card"><div className="card-title">{block.name}<small>{money(block.claimCost)}</small></div>{revealed ? <p className="compact">Earning {money(block.earningPotential)}/day · Heat exposure {block.heatExposure} · Curtis visibility {block.curtisVisibility} · patrol {block.patrolFrequency}.</p> : <p className="muted compact">Numbers unconfirmed. Eli's map reveals real stats before you commit.</p>}<button className="btn full secondary" disabled={!claim.available} onClick={() => dispatch({ type: "CLAIM_BLOCK", blockId: block.id })}>Claim block · {money(block.claimCost)}<span className="action-copy">{claim.available ? "Uses one part of day" : claim.reason}</span></button></div>;
}

function Soldiers({ state, dispatch, onBack }) {
  const recruit = C.selectors.soldierRecruitAvailability(state); const capacity = C.selectors.soldierCapacity(state);
  const active = Object.values(state.world.soldiers).filter((item) => item.status === "active"); const unassigned = active.filter((item) => !item.blockId);
  const controlledBlocks = C.SPENARD_BLOCKS.filter((block) => state.world.territoryBlocks[block.id].owner === "player");
  const policy = state.people.crew.eli.operationPolicy || "manual";
  const automated = policy !== "manual";
  return <><PageHead title="Soldiers" sub="Anonymous manpower. Capacity and assignment only, with no individual records" onBack={onBack} /><div className="scroll">
    <div className="metric-row">
      <div className="metric-tile"><span className="k">Active</span><span className="v">{active.length}/{capacity}</span></div>
      <div className="metric-tile"><span className="k">Assigned</span><span className="v">{active.length - unassigned.length}</span></div>
      <div className="metric-tile"><span className="k">Available</span><span className="v">{unassigned.length}</span></div>
    </div>
    <button className="btn full primary" disabled={!recruit.available} onClick={() => dispatch({ type: "RECRUIT_SOLDIER" })}>Recruit a soldier · {money(recruit.cost || C.SOLDIER_RECRUIT_COST)}<span className="action-copy">{recruit.available ? "Free · no time passes" : recruit.reason}</span></button>
    {unassigned.length > 0 && automated && <p className="muted compact">Eli is running the {C.ELI_OPERATION_POLICIES[policy]?.label || "Balanced"} order. Available soldiers are placed automatically overnight, no action needed.</p>}
    {unassigned.length > 0 && !automated && <div className="section-label">Assign to a block · Manual policy</div>}
    {unassigned.length > 0 && !automated && unassigned.map((soldier) => <div className="card" key={soldier.id}><div className="card-title">Unassigned soldier<small>Hired Day {soldier.hiredDay}</small></div>{controlledBlocks.length ? <div className="btn-row">{controlledBlocks.map((block) => { const avail = C.selectors.soldierAssignAvailability(state, soldier.id, block.id); return <button className="btn secondary" key={block.id} disabled={!avail.available} onClick={() => dispatch({ type: "ASSIGN_SOLDIER", soldierId: soldier.id, blockId: block.id })}>{block.name}<span className="action-copy">{avail.available ? "Free · no time cost" : avail.reason}</span></button>; })}</div> : <p className="muted compact">Claim a block in Territory before you can post anyone.</p>}</div>)}
  </div></>;
}

function TerritoryCard({ state, dispatch, definition }) {
  const territory = state.world.territories[definition.areaId]; const crewOnly = C.selectors.takeoverReadiness(state, definition.areaId, false); const joined = C.selectors.takeoverReadiness(state, definition.areaId, true); const estimate = C.selectors.territoryPowerEstimate(state, definition.areaId); const name = C.NEIGHBORHOODS.find((area) => area.id === definition.areaId).name;
  const district = C.selectors.districtControlTier(state, definition.areaId);
  if (territory.owner === "player") return <div className="card cleared-card"><div className="card-title">{name}<small>{`DISTRICT CONTROL: ${district.label.toUpperCase()}`}</small></div><p className="compact">{district.hasBlockLayer ? `Income now comes from Territory Blocks, not this district directly.` : `Daily income ${money(definition.dailyIncome)}.`} 4% better buying and selling · risk reduced by 1.</p><p className="muted compact">{definition.special} Total collected: {money(territory.incomeCollected)}.</p></div>;
  return <div className="card debt-card"><div className="card-title">Attack {name}<small>{money(definition.attackCost)} · one part of day</small></div><p className="compact">Your crew Power: <b>{C.selectors.crewPower(state, false)}</b> · Curtis estimate: <b>{estimate.label}</b></p><p className="muted compact">Best of three automatic rounds. Ties favor Curtis. A loss permanently removes one participating crew member.</p><button className="btn full secondary" disabled={!crewOnly.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: false })}>Send the crew<span className="action-copy">{crewOnly.available ? `Power ${crewOnly.crewPower} · you stay safe` : crewOnly.reason}</span></button><button className="btn full primary choice" disabled={!joined.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: true })}>Join the attack<span>Power {C.selectors.crewPower(state, true)} · lose 20–30 Health if the operation fails</span></button></div>;
}

function CrewDetail({ state, dispatch, person, onBack }) {
  const crew = state.people.crew[person.id]; const cost = C.selectors.recruitmentCost(state, person.id); const eliTest = person.id === "eli" ? C.selectors.eliTestRouteAvailability(state) : null;
  const tier = C.selectors.crewTierAvailability(state, person.id);
  const liability = person.id === "eli" ? "A compromised route can add Heat; unpaid wages cut his Power." : person.id === "pherris" ? "She expects ownership and may withhold information when treated like a list." : "His methods can raise Heat and provoke Curtis.";
  return <><PageHead title={person.name} sub={`${person.role} · Crew Power ${person.power}`} onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Current status<small>{crew.contactStage.replaceAll("_", " ")}</small></div><p>{person.description}</p><div className="detail-list"><span><b>Recruitment:</b> {money(cost)}</span><span><b>Daily wage:</b> {money(person.wage)}</span><span><b>Capacity:</b> 1 field crew slot</span><span><b>Primary benefit:</b> Power {person.power} and role-specific operation choices</span><span><b>Main liability:</b> {liability}</span><span><b>Hiring time:</b> Free at North Star Garage</span></div></div>
    {person.id === "eli" && !crew.recruited && <div className="card"><div className="card-title">Give Eli a Test Route<small>$35 · one part of day</small></div><p className="muted">Fund a small service-road delivery. A clean run can earn modest cash; trouble can cost Health and add Heat. Completing it unlocks recruitment.</p><button className="btn full primary" disabled={!eliTest.available} onClick={() => dispatch({ type: "ELI_TEST_ROUTE" })}>Start the test route<span className="action-copy">{eliTest.reason}</span></button></div>}
    {((crew.introduced && person.id !== "eli") || person.id === "deshawn") && !crew.recruited && <button className="btn full good-btn" disabled={!state.base.visiting || state.player.cash < cost || (person.id === "deshawn" && !C.selectors.deshawnRecruitmentAvailability(state).available)} onClick={() => dispatch({ type: "RECRUIT_CREW", crewId: person.id })}>Recruit {person.name.split(" ")[0]} · {money(cost)}<span className="action-copy">{person.id === "deshawn" ? C.selectors.deshawnRecruitmentAvailability(state).reason : "Free at North Star Garage"}</span></button>}
    {crew.introduced && !crew.recruited && person.id === "eli" && crew.contactStage === "recruitable" && <button className="btn full good-btn" disabled={!state.base.visiting || state.player.cash < cost || C.selectors.recruitedCrew(state).length >= C.selectors.crewCapacityFor(state)} onClick={() => dispatch({ type: "RECRUIT_CREW", crewId: person.id })}>Recruit Eli · {money(cost)}<span className="action-copy">Free at North Star Garage</span></button>}
    {crew.recruited && <div className="card"><p>Active · Loyalty {crew.loyalty} · wages due {money(crew.wageDue)} · assignment {crew.assignment || "none"}</p>{crew.wageDue > 0 && <button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < crew.wageDue} onClick={() => dispatch({ type: "PAY_CREW", crewId: person.id })}>Pay wages · {money(crew.wageDue)}<span className="action-copy">Clears the unpaid Power penalty without advancing time</span></button>}</div>}
    {crew.recruited && ["pherris", "tone", "deshawn"].includes(person.id) && <div className="card"><div className="card-title">Relationship track<small>TIER {crew.tier}</small></div><button className="btn full primary" disabled={!tier.available} onClick={() => dispatch({ type: "PROMOTE_CREW_TIER", crewId: person.id })}>Advance relationship tier<span className="action-copy">{tier.available ? `${tier.cost ? money(tier.cost) : "Free"} · no time passes` : tier.reason}</span></button></div>}
    {person.id === "eli" && crew.recruited && (crew.lieutenantStage === "operations_lieutenant" ? <div className="card cleared-card"><div className="card-title">Operations Lieutenant<small>Effectiveness {crew.lieutenantEffectiveness}/3</small></div><p className="compact">Eli places soldiers, rotates corners, and defends territory without a check-in each time.</p>
      {findEliReport(state) && <EliReportCard state={state} />}
      <div className="section-label">Standing order</div>
      <div className="policy-grid" role="radiogroup" aria-label="Eli's standing order">{Object.entries(C.ELI_OPERATION_POLICIES).map(([id, policy]) => <button key={id} role="radio" aria-checked={crew.operationPolicy === id} className={`policy-btn${crew.operationPolicy === id ? " active" : ""}`} onClick={() => dispatch({ type: "SET_ELI_POLICY", policy: id })}><b>{policy.label}</b><span>{policy.description}</span></button>)}</div>
      <p className="muted compact">Changing the order costs no time. {crew.operationPolicy === "manual" ? "Assign soldiers yourself in Soldiers." : "Eli places and redistributes soldiers automatically each night."}</p>
    </div> : (() => { const promo = C.selectors.eliPromotionAvailability(state); return <div className="card"><div className="card-title">Promote to Operations Lieutenant<small>Runs soldiers and corners on their own</small></div><p className="muted compact">Needs Eli's loyalty to reach {C.ELI_LIEUTENANT_UNLOCK.minLoyalty}.</p><button className="btn full primary" disabled={!promo.available} onClick={() => dispatch({ type: "PROMOTE_LIEUTENANT", crewId: "eli" })}>Give Eli Operations<span className="action-copy">{promo.available ? "Free · no time passes" : promo.reason}</span></button></div>; })())}
  </div></>;
}

function DealerDetail({ state, dispatch, dealer, onBack }) {
  const record = C.selectors.dealerRecord(state, dealer.id);
  const actions = C.selectors.dealerActions(state, dealer.id);
  return <><PageHead title={dealer.name} sub={`Street contact · ${dealer.where}`} onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">{dealer.name}<small>{C.selectors.dealerStandingLabel(record)}</small></div>
      <p>{record.known ? "He works the corner off the dryer vents and keeps his own hours. He remembers who paid fairly and who did not." : "You have not met him yet."}</p>
      {record.robbedCount > 0 && <p className="warn">He has been robbed {record.robbedCount === 1 ? "once" : `${record.robbedCount} times`} and has not forgotten it.</p>}
      {record.supplyChoked > 0 && <p className="warn">Nothing is moving on this block while he is off the corner.</p>}
    </div>
    <button className="btn full secondary choice" disabled={!actions.buy.available} onClick={() => dispatch({ type: "BUY_FROM_DEALER", dealerId: dealer.id })}>Buy off {dealer.name.split(" ")[0]}<span>{actions.buy.reason}</span></button>
    <button className="btn full secondary choice" disabled={!actions.ask.available} onClick={() => dispatch({ type: "ASK_DEALER", dealerId: dealer.id })}>Ask what is moving<span>{actions.ask.reason}</span></button>
    <button className="btn full primary choice" disabled={!actions.rob.available} onClick={() => dispatch({ type: "ROB_DEALER", dealerId: dealer.id })}>Rob {dealer.name.split(" ")[0]}<span>{actions.rob.reason}</span></button>
  </div></>;
}

function People({ state, dispatch, navigateMore }) {
  const [page, setPage] = useState("root");
  if (page === "contacts") return <><PageHead title="Contacts" sub="Personal and social contacts in one place" onBack={() => setPage("root")} /><div className="scroll"><SocialContacts state={state} dispatch={dispatch} navigateMore={navigateMore} /></div></>;
  if (page.startsWith("dealer:")) { const dealer = C.DEALERS.find((item) => item.id === page.split(":")[1]); return <DealerDetail state={state} dispatch={dispatch} dealer={dealer} onBack={() => setPage("dealers")} />; }
  if (page === "dealers") return <><PageHead title="Street Contacts" sub="Corners you can buy from, ask, or take" onBack={() => setPage("root")} /><div className="scroll">{C.DEALERS.map((dealer) => { const record = C.selectors.dealerRecord(state, dealer.id); return <CategoryCard key={dealer.id} title={dealer.name} status={C.selectors.dealerStandingLabel(record)} description={record.known ? `Works ${dealer.where}. Fair business, a straight answer, or a stickup. He remembers which one you chose.` : "Somebody on this block is holding, but you have not met them yet."} disabled={!record.known} onClick={() => setPage(`dealer:${dealer.id}`)} />; })}</div></>;
  if (page.startsWith("crew:")) { const person = C.CREW.find((item) => item.id === page.split(":")[1]); return <CrewDetail state={state} dispatch={dispatch} person={person} onBack={() => setPage("crew")} />; }
  if (page === "crew") return <><PageHead title="Crew" sub={`${C.selectors.recruitedCrew(state).length}/${C.selectors.crewCapacityFor(state)} active · recruitment, wages, tiers, and assignments`} onBack={() => setPage("root")} /><div className="scroll">{C.CREW.map((person) => { const crew = state.people.crew[person.id]; const availableDeshawn = person.id === "deshawn" && C.selectors.deshawnRecruitmentAvailability(state).available; return <CategoryCard key={person.id} title={person.name} status={crew.recruited ? `Tier ${crew.tier} · ${money(crew.wageDue)} due` : crew.introduced || availableDeshawn ? crew.contactStage.replaceAll("_", " ") : "Not introduced"} description={`${person.role} · Power ${person.power}. ${crew.introduced || availableDeshawn ? person.description : "This contact has not entered the run yet."}`} disabled={!crew.introduced && !availableDeshawn} onClick={() => setPage(`crew:${person.id}`)} />; })}</div></>;
  if (page === "lieutenants") { const lieutenants = C.CREW.filter((person) => person.lieutenantRole && state.people.crew[person.id].recruited); return <><PageHead title="Lieutenants" sub="People running part of the operation without a check-in each time" onBack={() => setPage("root")} /><div className="scroll">{lieutenants.map((person) => { const crew = state.people.crew[person.id]; const status = crew.lieutenantStage === "operations_lieutenant" ? `${C.ELI_OPERATION_POLICIES[crew.operationPolicy]?.label || "Balanced"} · Eff ${crew.lieutenantEffectiveness}/3` : "Crew, not yet promoted"; return <CategoryCard key={person.id} title={person.name} status={status} description={`Operations lieutenant. ${person.description}`} onClick={() => setPage(`crew:${person.id}`)} />; })}</div></>; }
  if (page === "history") return <><PageHead title="Recent History" sub="Choices and callbacks from this run" onBack={() => setPage("root")} /><div className="scroll">{state.stats.majorDecisions.slice().reverse().map((entry, index) => <div className="card compact" key={index}>{entry}</div>)}</div></>;
  const activeLieutenants = C.CREW.filter((person) => person.lieutenantRole && state.people.crew[person.id].recruited);
  const knownDealers = C.DEALERS.filter((item) => state.people.dealers?.[item.id]?.known).length;
  const introducedCrew = C.CREW.filter((person) => state.people.crew[person.id].introduced).length;
  const socialContacts = C.selectors.knownSocialContacts(state);
  // Categories appear as the run produces people to put in them. An empty
  // "Crew 0/2" row on the first Morning teaches the player nothing.
  return <><PageHead title="People" sub="Contacts, street contacts, crew, lieutenants, and history" /><div className="scroll">
    <MenuRow title="Contacts" status={`${C.selectors.personalContacts(state).length + socialContacts.filter((person) => !["yalonda", "juan"].includes(person.id)).length} known`} description="Personal contacts plus coworkers and Night Owl regulars." onClick={() => setPage("contacts")} />
    {knownDealers > 0 && <MenuRow title="Street Contacts" status={`${knownDealers} known`} description="Corner suppliers. Buy, ask what is moving, or take it off them." onClick={() => setPage("dealers")} />}
    {introducedCrew > 0 && <MenuRow title="Crew" status={`${C.selectors.recruitedCrew(state).length}/${C.selectors.crewCapacityFor(state)} active`} description="Recruitment stages, wages, assignments, and crew capacity." onClick={() => setPage("crew")} />}
    {activeLieutenants.length > 0 && <MenuRow title="Lieutenants" status={`${activeLieutenants.length} active`} description="The people running part of the organization without a check-in." onClick={() => setPage("lieutenants")} />}
    {state.stats.majorDecisions.length > 0 && <MenuRow title="Recent History" status={`${state.stats.majorDecisions.length} decisions`} description="Choices that later scenes may call back." onClick={() => setPage("history")} />}
  </div></>;
}

function Rob({ state, dispatch, onBack }) {
  const score = C.selectors.robAvailability(state); const stats = state.stats.robbery;
  return <><PageHead title="Rob" sub="A risky comeback option; legal work remains the safer long-term plan" onBack={onBack} /><div className="scroll"><div className="outcome-grid"><Outcome label="Attempts" value={stats.attempts || 0} /><Outcome label="Successes" value={stats.successes || 0} /><Outcome label="Failures" value={stats.failures || 0} /><Outcome label="Total payout" value={money(stats.totalPayout || 0)} /></div><div className="card debt-card"><div className="card-title">Service-road envelope<small>Once each day · one part of day</small></div><p>Take a direct cash risk. Weapons, Combat, Intelligence, crew, and Heat affect the approach. Repeated attempts raise exposure and injury risk.</p><button className="btn full primary" disabled={!score.available} onClick={() => dispatch({ type: "ROB" })}>Attempt today's Rob<span className="action-copy">{score.available ? `${score.chanceLabel} estimated success · uses one part of day` : score.reason}</span></button></div></div></>;
}

function Gear({ state, dispatch, onBack }) { return <><PageHead title="Gear" sub="Weapons, armor, tools, utility, and consumables" onBack={onBack} /><div className="scroll">{!state.base.visiting && <p className="warn">Visit North Star Garage in Safehouse before buying gear.</p>}{C.GEAR.map((gear) => { const owned = state.player.gear.owned.includes(gear.id); return <div className="card" key={gear.id}><div className="card-title">{gear.name}<small>{owned ? "EQUIPPED" : money(gear.cost)}</small></div><p className="compact muted">{gear.description}</p><button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < gear.cost || (owned && gear.id !== "medical_kit")} onClick={() => dispatch({ type: "BUY_GEAR", gearId: gear.id })}>{owned ? "Owned" : "Buy"}<span className="action-copy">Free purchase · no time passes</span></button></div>; })}</div></>; }

// Safehouse was the longest page in the build (over five screens of content at
// 320px). It is now a hub: protected cash, storage, upgrades, and assignments
// each get a page that answers one question.
const CREW_ASSIGNMENTS = { eli: [["north_run", "Spenard run"], ["outer_run", "Industrial route"]], pherris: [["source_cocaine", "Source Cocaine"], ["source_meth", "Source Meth"]], tone: [["guard_base", "Guard the garage"], ["intimidate_buyer", "Pressure a buyer"]] };

function ProtectedCash({ state, dispatch, onBack }) {
  const [amount, setAmount] = useState(0); const cashCap = C.selectors.storedCashCapacity(state);
  const storeAmount = Math.min(Math.max(0, Number(amount) || 0), state.player.cash, Math.max(0, cashCap - state.base.storedCash));
  const retrieveAmount = Math.min(Math.max(0, Number(amount) || 0), state.base.storedCash);
  return <><PageHead title="Protected Cash" sub="Money the street cannot reach" onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">Protected cash<small>{money(state.base.storedCash)} / {money(cashCap)}</small></div><p className="muted compact">Cash here is included in working capital and protected by storage upgrades.</p>
      <div className="field-row"><input aria-label="Protected cash amount" type="number" min="0" value={amount || ""} placeholder="Amount" onChange={(event) => setAmount(event.target.value)} /><button className="btn secondary" disabled={!storeAmount} onClick={() => dispatch({ type: "STORE_CASH", amount: storeAmount })}>Store</button><button className="btn secondary" disabled={!retrieveAmount} onClick={() => dispatch({ type: "RETRIEVE_CASH", amount: retrieveAmount })}>Retrieve</button></div>
      {cashCap === 0 && <p className="warn compact">Install the Hidden Compartment upgrade to unlock protected cash.</p>}
    </div>
  </div></>;
}

function SafehouseStorage({ state, dispatch, onBack }) {
  return <><PageHead title="Storage" sub={`Stored inventory · ${C.selectors.storedCargoUsed(state)}/${C.selectors.storageCapacity(state)}`} onBack={onBack} /><div className="scroll">
    {C.PRODUCTS.map((product) => { const carried = state.player.inventory[product.id]; const stored = state.base.storedInventory[product.id]; return <div className="card inventory-row" key={product.id}><div><div className="card-title">{product.name}</div><div className="muted">Carried {carried.qty} · stored {stored.qty}</div></div><button className="btn secondary" disabled={!carried.qty || C.selectors.storedCargoUsed(state) >= C.selectors.storageCapacity(state)} onClick={() => dispatch({ type: "STORE_PRODUCT", productId: product.id, qty: Math.min(carried.qty, C.selectors.storageCapacity(state) - C.selectors.storedCargoUsed(state)) })}>Store</button><button className="btn secondary" disabled={!stored.qty || C.selectors.cargoUsed(state) >= C.selectors.cargoCapacity(state)} onClick={() => dispatch({ type: "RETRIEVE_PRODUCT", productId: product.id, qty: Math.min(stored.qty, C.selectors.cargoCapacity(state) - C.selectors.cargoUsed(state)) })}>Take</button></div>; })}
  </div></>;
}

function BaseUpgrades({ state, dispatch, onBack }) {
  return <><PageHead title="Upgrades" sub="Security, storage, operations, and recovery tracks" onBack={onBack} /><div className="scroll">
    {["security", "storage", "operations", "recovery"].map((track) => { const next = C.BASE_UPGRADES.find((item) => item.track === track && item.level === state.base.tracks[track] + 1); return <div className="card" key={track}><div className="card-title">{track}<small>Level {state.base.tracks[track]}/2</small></div>{next ? <><p className="compact">{next.name} · {money(next.cost)}</p><p className="muted compact">{next.description}</p><button className="btn full secondary" disabled={state.player.cash < next.cost} onClick={() => dispatch({ type: "UPGRADE_BASE", track })}>Install upgrade<span className="action-copy">{state.player.cash < next.cost ? `You need ${money(next.cost - state.player.cash)} more.` : "Free upgrade · no time passes"}</span></button></> : <p className="muted compact">Track complete.</p>}</div>; })}
  </div></>;
}

function CrewAssignments({ state, dispatch, onBack }) {
  const fieldCrew = C.selectors.recruitedCrew(state).filter((person) => person.canFieldAssign);
  const network = C.selectors.recruitedCrew(state).filter((person) => !person.canFieldAssign);
  return <><PageHead title="Assignments" sub="Who works with you and what they are doing" onBack={onBack} /><div className="scroll">
    {!fieldCrew.length && !network.length && <p className="muted compact">Nobody works with you yet. Recruit through People → Crew.</p>}
    {fieldCrew.map((person) => { const crew = state.people.crew[person.id]; return <div className="card" key={person.id}><div className="card-title">{person.name}<small>{crew.assignment || "Available"}</small></div>{!crew.assignment && <div className="btn-row">{(CREW_ASSIGNMENTS[person.id] || []).map(([id, label]) => <button className="btn secondary" key={id} onClick={() => dispatch({ type: "ASSIGN_CREW", crewId: person.id, assignment: id })}>{label}<span className="action-copy">Free assignment</span></button>)}</div>}</div>; })}
    {network.map((person) => <div className="card cleared-card" key={person.id}><div className="card-title">{person.name}<small>{person.lieutenantRole ? `${person.lieutenantRole} lieutenant` : "Contact"}</small></div><p className="muted compact">Runs the network, not a corner. No field assignment.</p></div>)}
  </div></>;
}

function Safehouse({ state, dispatch, onBack }) {
  const [page, setPage] = useState("root");
  if (page === "cash") return <ProtectedCash state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "storage") return <SafehouseStorage state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "upgrades") return <BaseUpgrades state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "assignments") return <CrewAssignments state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (!state.base.controlled) return <><PageHead title="Safehouse" sub="North Star Garage" onBack={onBack} /><div className="scroll"><div className="card locked"><div className="card-title">North Star Garage<small>NOT OWNED</small></div><p className="compact">Lease the property through Travel → Listings before using storage, upgrades, recovery, gear, or crew operations.</p></div></div></>;
  if (!state.base.visiting) return <><PageHead title="Safehouse" sub="North Star Garage" onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Visit North Star Garage<small>Uses one part of day</small></div><p className="compact">Close the current market and roll down the garage door. Management remains available until another time-consuming action moves you on.</p><button className="btn full primary" onClick={() => dispatch({ type: "VISIT_BASE" })}>Go to the garage<span className="action-copy">Uses one part of day</span></button></div></div></>;
  const crewCount = C.selectors.recruitedCrew(state).length;
  const nextUpgrade = ["security", "storage", "operations", "recovery"].filter((track) => state.base.tracks[track] < 2).length;
  return <><PageHead title="Safehouse" sub="North Star Garage · the garage is open" onBack={onBack} /><div className="scroll">
    <div className="tag good">GARAGE OPEN</div>
    <MenuRow title="Protected Cash" status={`${money(state.base.storedCash)} / ${money(C.selectors.storedCashCapacity(state))}`} description="Store and retrieve money the street cannot reach." onClick={() => setPage("cash")} />
    <MenuRow title="Storage" status={`${C.selectors.storedCargoUsed(state)}/${C.selectors.storageCapacity(state)}`} description="Move product between what you carry and what stays here." onClick={() => setPage("storage")} />
    <MenuRow title="Upgrades" status={nextUpgrade ? `${nextUpgrade} tracks open` : "Complete"} description="Security, storage, operations, and recovery." onClick={() => setPage("upgrades")} />
    {crewCount > 0 && <MenuRow title="Assignments" status={`${crewCount} crew`} description="Send field crew out on a run, a source, or a guard job." onClick={() => setPage("assignments")} />}
  </div></>;
}

// Short organization snapshot, kept off the Operations hub so the hub stays a
// list of destinations rather than a dashboard.
function OperationsOverview({ state, onBack }) {
  const eliActive = C.selectors.eliLieutenantActive(state);
  const eli = state.people.crew.eli;
  const report = findEliReport(state);
  return <><PageHead title="Overview" sub="What the organization looks like right now" onBack={onBack} /><div className="scroll">
    <div className="metric-row">
      <div className="metric-tile"><span className="k">Soldiers</span><span className="v">{C.selectors.activeSoldierCount(state)}/{C.selectors.soldierCapacity(state)}</span></div>
      <div className="metric-tile"><span className="k">Blocks</span><span className="v">{C.selectors.controlledBlockCount(state)}/{C.SPENARD_BLOCKS.length}</span></div>
      <div className="metric-tile"><span className="k">District</span><span className="v">{C.selectors.districtControlTier(state, "north_star_lot").label}</span></div>
      <div className="metric-tile"><span className="k">Respect</span><span className="v">{state.npc.curtis.respect}</span></div>
    </div>
    {eliActive && <div className="card"><div className="card-title">Standing order<small>{C.ELI_OPERATION_POLICIES[eli.operationPolicy]?.label || "Balanced"}</small></div><p className="compact muted">Effectiveness {eli.lieutenantEffectiveness}/3 · estimated weekly income {money(C.selectors.weeklyIncomeEstimate(state))}. Change the order in People → Lieutenants.</p></div>}
    {report && <EliReportCard state={state} />}
    {state.base.controlled && !eliActive && <div className="warning-card"><div className="card-title">No Operations Lieutenant</div><p className="compact">Nobody is running the field for you. Soldiers and Territory Blocks stay locked until Eli is promoted in People → Crew.</p></div>}
  </div></>;
}

// Strategic layer. Deliberately separate from the Territory block board so the
// two never read as the same number twice.
function DistrictControlPage({ state, dispatch, onBack }) {
  const district = C.selectors.districtControlTier(state, "north_star_lot");
  return <><PageHead title="District Control" sub="Neighborhood-wide dominance, not another income line" onBack={onBack} /><div className="scroll">
    <div className="district-summary">
      <div className="card-title">District Control<small>Spenard</small></div>
      <div className="tier">{district.label}</div>
      <p className="compact muted">{district.blocks}/{C.SPENARD_BLOCKS.length} blocks held{district.capstone ? " · capstone requirement met" : ""}. Strategic dominance on top of income; the blocks already pay for themselves.</p>
      <div className="district-meter"><span style={{ width: `${Math.min(100, Math.round((district.blocks / C.SPENARD_BLOCKS.length) * 100))}%` }} /></div>
    </div>
    <div className="section-label">Other Districts</div>
    {C.TERRITORIES.filter((definition) => definition.areaId !== "north_star_lot").map((definition) => <TerritoryCard key={definition.areaId} state={state} dispatch={dispatch} definition={definition} />)}
  </div></>;
}

// Tactical layer: the block board and one selected block's detail.
function TerritoryBlocks({ state, dispatch, onBack, openDistrict }) {
  const [selectedBlock, setSelectedBlock] = useState(null);
  const eliActive = C.selectors.eliLieutenantActive(state);
  const district = C.selectors.districtControlTier(state, "north_star_lot");
  const selected = C.SPENARD_BLOCKS.find((item) => item.id === selectedBlock);
  return <><PageHead title="Territory" sub="What do you control, and where can you expand?" onBack={onBack} /><div className="scroll">
    <div className="section-label">Territory Blocks · Spenard</div>
    {!eliActive ? <div className="warning-card"><div className="card-title">Blocks Locked</div><p className="compact">Promote Eli to Operations Lieutenant before claiming Spenard corners.</p></div> : <>
      <div className="territory-board" aria-label="Spenard territory blocks">
        {C.SPENARD_BLOCKS.map((block) => {
          const record = state.world.territoryBlocks[block.id];
          const ownState = record.owner === "player" ? "player" : record.owner === "curtis" ? "curtis" : "unknown";
          const label = record.owner === "player" ? "Controlled" : record.owner === "curtis" ? "Curtis Held" : "Unclaimed";
          return <button key={block.id} className={`block-node ${ownState}${selectedBlock === block.id ? " selected" : ""}`} aria-pressed={selectedBlock === block.id} onClick={() => setSelectedBlock(selectedBlock === block.id ? null : block.id)}>
            <span className="node-name">{block.name}</span>
            <span className="node-state">{label}</span>
          </button>;
        })}
      </div>
      {selected && <SpenardBlockCard state={state} dispatch={dispatch} block={selected} />}
      {!selected && <p className="muted compact">Tap a block to see its detail and claim it.</p>}
    </>}
    <MenuRow title="District Control" status={district.label} description={`${district.blocks}/${C.SPENARD_BLOCKS.length} blocks held. Strategic dominance and other districts.`} onClick={openDistrict} />
  </div></>;
}

function Operations({ state, dispatch, onBack, initialPage }) {
  const [page, setPage] = useState(initialPage || "root");
  const eliActive = C.selectors.eliLieutenantActive(state);
  if (page === "overview") return <OperationsOverview state={state} onBack={() => setPage("root")} />;
  if (page === "rob") return <Rob state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "territory") return <TerritoryBlocks state={state} dispatch={dispatch} onBack={() => setPage("root")} openDistrict={() => setPage("district")} />;
  if (page === "district") return <DistrictControlPage state={state} dispatch={dispatch} onBack={() => setPage("territory")} />;
  if (page === "soldiers") return <Soldiers state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "gear") return <Gear state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "safehouse") return <Safehouse state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  const score = C.selectors.robAvailability(state);
  const blockCount = C.selectors.controlledBlockCount(state);
  const activeSoldiers = C.selectors.activeSoldierCount(state);
  const noLieutenantWarning = state.base.controlled && !eliActive;
  return <><PageHead title="Operations" sub="Run what you built" onBack={onBack} /><div className="scroll">
    {noLieutenantWarning && <div className="warning-card"><div className="card-title">No Operations Lieutenant</div><p className="compact">Eli is not running Operations yet. Soldiers and Territory Blocks stay locked until he is promoted in People → Crew.</p></div>}
    <MenuRow title="Overview" status={eliActive ? `${blockCount} blocks · ${activeSoldiers} soldiers` : "Snapshot"} description="A short read on the organization and Eli's latest report." onClick={() => setPage("overview")} />
    <MenuRow title="Safehouse" status={!state.base.controlled ? "Lease required" : state.base.visiting ? "Garage open" : `${money(state.base.storedCash)} protected`} description="North Star Garage: protected cash, storage, upgrades, and assignments." onClick={() => setPage("safehouse")} />
    {eliActive && <MenuRow title="Territory" status={`${blockCount}/${C.SPENARD_BLOCKS.length} blocks`} description="Claim and hold Spenard blocks; District Control sits behind it." onClick={() => setPage("territory")} />}
    {eliActive && <MenuRow title="Soldiers" status={`${activeSoldiers}/${C.selectors.soldierCapacity(state)}`} description="Recruit anonymous manpower and post it on controlled blocks." onClick={() => setPage("soldiers")} />}
    {!eliActive && <MenuRow title="District Control" status={C.selectors.districtControlTier(state, "north_star_lot").label} description="Neighborhood dominance and crew-based takeovers." disabled={!state.base.controlled} onClick={() => setPage("district")} />}
    <MenuRow title="Gear" status={`${state.player.gear.owned.length} owned`} description="Weapons, armor, utility, tools, and consumables." disabled={!state.base.controlled} onClick={() => setPage("gear")} />
    {!state.rob.visible && <MenuRow title="Rob" status={score.available ? "Available today" : "Unavailable"} description="A risky comeback option when the week turns against you." disabled={!state.base.controlled} onClick={() => setPage("rob")} />}
  </div></>;
}

function FinanceOverview({ state, onBack }) {
  return <><PageHead title="Overview" sub="Where the money actually sits" onBack={onBack} /><div className="scroll">
    <div className="metric-row">
      <div className="metric-tile dirty"><span className="k">Dirty</span><span className="v">{money(state.player.dirtyCash)}</span></div>
      <div className="metric-tile clean"><span className="k">Clean</span><span className="v">{money(state.player.cleanCash)}</span></div>
      <div className="metric-tile protected"><span className="k">Protected</span><span className="v">{money(state.base.storedCash + state.home.storedCash)}</span></div>
    </div>
    <div className="outcome-grid"><Outcome label="Street cash" value={money(state.player.cash)} /><Outcome label="Net worth" value={money(C.selectors.netWorth(state))} /><Outcome label="Financial Heat" value={state.player.financialHeat} /><Outcome label="Debt paid" value={money(state.lender.payments)} /></div>
    <p className="muted compact">Dirty cash spends, but spending it where records are kept builds Financial Heat. Clean cash does not.</p>
  </div></>;
}

// What do I owe, and what can I do about it? The lender's identity lives here,
// in the detail, rather than in the persistent HUD.
function DebtPage({ state, dispatch, onBack }) {
  const [amount, setAmount] = useState(0); const [confirmPayment, setConfirmPayment] = useState(false); const preview = C.selectors.debtPaymentPreview(state, amount); const safe = C.selectors.safeDebtPayment(state);
  function add(value) { setAmount(C.selectors.debtPaymentPreview(state, preview.amount + value).amount); }
  function commitPayment() { dispatch({ type: "PAY_DEBT", amount: preview.amount }); setAmount(0); setConfirmPayment(false); }
  function pay() { if (preview.breaksReserve) { setConfirmPayment(true); return; } commitPayment(); }
  const fixedTotal = state.lender.balance > 0 ? Math.max(state.lender.balance, state.lender.principal) : state.lender.principal;
  const daysLeft = state.lender.dueDay - state.run.day;
  const debtUrgency = !state.lender.balance ? null : daysLeft > 1 ? `Due Day ${state.lender.dueDay}` : daysLeft === 1 ? "1 day left" : daysLeft === 0 ? "Due tonight" : "Overdue. Enforcement active";
  return <><PageHead title="Debt & Obligations" sub="What you owe and what you can do about it" onBack={onBack} /><div className="scroll">
    <div className={`card debt-card${daysLeft <= 0 && state.lender.balance > 0 ? " warning-card" : ""}`}>
      <div className="debt-kicker">Debt{debtUrgency ? ` · ${debtUrgency}` : ""}</div>
      <div className="debt-amount">{state.lender.balance ? money(state.lender.balance) : "Paid in full"}</div>
    </div>
    <div className="card">
      <div className="debt-meta"><span>Lender: {state.lender.name}</span><span>{state.lender.relationship}</span></div>
      <div className="debt-meta"><span>Principal {money(state.lender.principal)} · fixed total {money(fixedTotal)}</span></div>
      {state.lender.collectorTier > 0 && <p className="warn compact">Collector enforcement active. Tier {state.lender.collectorTier}. Interest is running {Math.round((state.lender.interestMultiplier - 1) * 100)}% higher.</p>}
    </div>
    {state.lender.balance > 0 && <div className="card">
      <div className="payment-buttons"><button className="btn secondary" onClick={() => add(25)}>+$25</button><button className="btn secondary" onClick={() => add(50)}>+$50</button><button className="btn secondary" onClick={() => add(100)}>+$100</button><button className="btn secondary" onClick={() => setAmount(safe)}>Safe Maximum</button><button className="btn secondary" onClick={() => setAmount(preview.maximum)}>Pay Full</button>{C.selectors.debtGuidanceAvailable(state) && <button className="btn secondary" onClick={() => setAmount(Math.min(state.lender.balance, Math.max(25, Math.floor(safe / Math.max(1, 8 - state.run.day)))))}>Recommended</button>}</div>
      <input aria-label="Debt payment amount" type="number" min="0" max={preview.maximum} value={preview.amount || ""} placeholder="Payment amount" onChange={(event) => setAmount(C.selectors.debtPaymentPreview(state, event.target.value).amount)} />
      <div className="outcome-grid payment-preview"><Outcome label="Payment" value={money(preview.amount)} /><Outcome label="Cash remaining" value={money(preview.cashAfter)} /><Outcome label="Debt remaining" value={money(preview.debtAfter)} /></div>
      {preview.breaksReserve && <p className="warn compact">Warning: this crosses the {money(C.WORKING_CAPITAL_RESERVE)} working-capital reserve.</p>}
      <button className="btn full primary" disabled={!preview.amount} onClick={pay}>Pay {money(preview.amount)}<span className="action-copy">Free · no time passes</span></button>
    </div>}
    {state.npc.dre.known && <div className="card"><div className="card-title">Dre relationship<small>{C.selectors.dreTrustTier(state).toUpperCase()}</small></div><p>{state.npc.dre.cleanCompletions} clean missions · {state.npc.dre.refusals}/3 refusals · {state.npc.dre.loansRepaid} loans repaid.</p>
      {!state.npc.dre.activeMission ? <button className="btn full secondary" disabled={!C.selectors.dreMissionAvailability(state).available} onClick={() => dispatch({ type: "REQUEST_DRE_MISSION" })}>Ask for a mission<span className="action-copy">{C.selectors.dreMissionAvailability(state).reason}</span></button> : <><p className="warn">Current mission: {state.npc.dre.activeMission.missionId}</p><div className="btn-row"><button className="btn primary" onClick={() => dispatch({ type: "DRE_MISSION", outcome: "clean" })}>Clean</button><button className="btn secondary" onClick={() => dispatch({ type: "DRE_MISSION", outcome: "soft" })}>Soft</button><button className="btn secondary" onClick={() => dispatch({ type: "DRE_MISSION", outcome: "violent" })}>Force</button><button className="btn ghost" onClick={() => dispatch({ type: "REFUSE_DRE_MISSION" })}>Refuse</button></div><p className="muted compact">Completing the mission uses one part of day. Refusing is free.</p></>}
      {state.npc.dre.trust >= 2 && state.npc.dre.backstoryFragments.length < 5 && <button className="btn full ghost" onClick={() => dispatch({ type: "DRE_TALK" })}>Talk after business<span className="action-copy">Free · unlock a non-repeating history fragment</span></button>}
      {!state.lender.balance && <button className="btn full primary" onClick={() => dispatch({ type: "TAKE_DRE_LOAN" })}>Take {state.npc.dre.loansTaken ? "$1,200 / owe $1,380" : "$1,000 / owe $1,200"}<span className="action-copy">Free transaction · repeat note uses the earlier deadline</span></button>}
    </div>}
  </div>{confirmPayment && <ConfirmPrompt title="Cross the cash reserve?" text={`This leaves less than ${money(C.WORKING_CAPITAL_RESERVE)} in working cash.`} confirmLabel={`Pay ${money(preview.amount)}`} onConfirm={commitPayment} onCancel={() => setConfirmPayment(false)} />}</>;
}

function FinancialRisk({ state, openSafehouse }) {
  const heat = C.selectors.heatBand(state.player.heat);
  return <div className="scroll">
    <div className="metric-row">
      <div className="metric-tile"><span className="k">Financial Heat</span><span className="v">{state.player.financialHeat}</span></div>
      <div className="metric-tile"><span className="k">Police Heat</span><span className="v">{state.player.heat}/15 · {heat.label}</span></div>
      <div className="metric-tile dirty"><span className="k">Dirty Exposure</span><span className="v">{money(state.player.dirtyCash)}</span></div>
    </div>
    <div className="card"><div className="card-title">What builds it</div><p className="compact muted">Financial Heat rises when dirty cash pays for things that leave a record: property, upgrades, and large legitimate purchases. Existing clean cash stays clean, but no laundering service is available.</p></div>
    <div className="card"><div className="card-title">Protected cash<small>{money(state.base.storedCash + state.home.storedCash)}</small></div><p className="compact muted">Cash held at the garage or the spare room stays out of reach during raids and stickups.</p><button className="btn full secondary" disabled={!state.base.controlled} onClick={openSafehouse}>Manage protected cash in Safehouse<span className="action-copy">{state.base.controlled ? "No time cost to open the garage list" : "Lease North Star Garage first"}</span></button></div>
  </div>;
}

function Finances({ state, dispatch, onBack, openSafehouse, initialPage }) {
  const [page, setPage] = useState(initialPage || "root");
  if (page === "overview") return <FinanceOverview state={state} onBack={() => setPage("root")} />;
  if (page === "debt" && state.npc.dre.known) return <DebtPage state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "risk") return <><PageHead title="Financial Risk" sub="Financial Heat, exposure, and what is protected" onBack={() => setPage("root")} /><FinancialRisk state={state} openSafehouse={openSafehouse} /></>;
  const hasDreDebt = state.npc.dre.known;
  const daysLeft = hasDreDebt ? state.lender.dueDay - state.run.day : null;
  const debtStatus = !state.lender.balance ? (state.npc.dre.loansRepaid ? "Paid in full" : "No open note") : daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due tonight" : daysLeft === 1 ? "Due tomorrow" : `Due Day ${state.lender.dueDay}`;
  const showRisk = state.player.financialHeat > 0 || state.player.dirtyCash > 0;
  return <><PageHead title="Finances" sub="Cash, debt, and financial risk across the operation" onBack={onBack} /><div className="scroll">
    <div className="stat-row">
      <StatTile label="Cash" value={money(state.player.cash)} tone="good" />
      <StatTile label="Net Worth" value={money(C.selectors.netWorth(state))} tone={C.selectors.netWorth(state) < 0 ? "bad" : ""} />
    </div>
    <MenuRow title="Overview" status={`${money(state.player.dirtyCash)} dirty`} description="Dirty, clean, protected, net worth, and Financial Heat." onClick={() => setPage("overview")} />
    {hasDreDebt && <MenuRow title="Debt & Obligations" status={debtStatus} description={state.lender.balance ? `${money(state.lender.balance)} remaining. Payment controls and lender detail.` : "The note is clear. History and lender detail."} tone={daysLeft <= 0 && state.lender.balance > 0 ? "bad" : ""} onClick={() => setPage("debt")} />}
    {showRisk && <MenuRow title="Financial Risk" status={`Financial Heat ${state.player.financialHeat}`} description="Suspicious spending, exposure, and protected cash." onClick={() => setPage("risk")} />}
  </div></>;
}

function Recovery({ state, dispatch, onBack }) {
  const layLow = C.selectors.layLowPreview(state); const doctorOpen = state.base.tracks.recovery >= 2 || state.npc.mina.trust >= 3;
  const treatment = (amount, originalCost, name, copy) => { const cost = C.selectors.treatmentCost(state, originalCost); return <div className="card inventory-row" key={name}><div><div className="card-title">{name}</div><div className="muted">{copy} · restore up to {amount} Health</div></div><button className="btn good-btn" disabled={state.player.cash < cost || state.player.health >= 100} onClick={() => dispatch({ type: "HEAL", amount, cost })}>{money(cost)}<span className="action-copy">One part of day</span></button></div>; };
  const firstAidCost = C.selectors.treatmentCost(state, 55);
  return <><PageHead title="Recovery" sub="Essential care first; larger options appear when the damage justifies them" onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Health<small>{state.player.health}/100</small></div><div className="meter"><span style={{ width: `${state.player.health}%`, background: state.player.health < 40 ? "var(--red)" : "var(--green)" }} /></div></div><div className="card inventory-row"><div><div className="card-title">First aid</div><div className="muted">Immediate care · restore up to 18 Health</div></div><button className="btn good-btn" disabled={state.player.cash < firstAidCost || state.player.health >= 100} onClick={() => dispatch({ type: "USE_FIRST_AID", amount: 18, cost: firstAidCost })}>{money(firstAidCost)}<span className="action-copy">Free · no time passes</span></button></div>{state.player.health <= 82 && treatment(40, 135, "Clinic visit", "Larger treatment for a serious injury")}{state.player.health <= 55 && (doctorOpen ? treatment(75, 290, "No-Questions Doctor", "Private care unlocked through trust or Safehouse recovery") : <div className="card locked"><div className="card-title">Private medical contact<small>Locked</small></div><p className="muted">Build a trusted medical relationship or install the Safe Room recovery upgrade.</p></div>)}<div className="card"><div className="card-title">Lay Low<small>Next part of day</small></div><p>Expected immediate result: lower Heat by {layLow.heatReduction}. Debt, wages, markets, and Curtis continue moving while the lights are off.</p><button className="btn full secondary" onClick={() => dispatch({ type: "LAY_LOW" })}>Lay Low<span className="action-copy">Lowers Heat and advances time</span></button></div></div></>;
}

function Help({ onBack, marketVisible }) { return <><PageHead title="How to Play" sub="The four-part rhythm of One Good Run" onBack={onBack} /><div className="scroll"><div className="card"><h2>Your run</h2><p>Each day contains Morning, Afternoon, Evening, and Night. Week Zero establishes your life in Spenard. A later approach sets the checkpoint.</p></div>{marketVisible && <div className="card"><h2>Market visits</h2><p>Buy and sell several times at locked prices. Trading does not advance time until you close the visit.</p></div>}<div className="card"><h2>Major actions</h2><p>Travel, recovery, meetings, debt payments, and operations advance to the next part of day. Resolve an event choice without paying a second time cost.</p></div><div className="card"><h2>The pressure phase</h2><p>Protect working capital, manage Heat and Health, build relationships, and decide whether territory or a clean exit is worth the risk.</p></div></div></>; }

function Character({ state, onBack }) {
  const identity = C.STREET_IDENTITIES[state.player.streetIdentity] || C.STREET_IDENTITIES.unproven;
  const ratings = C.selectors.derivedRatings(state);
  const attributes = [
    ["strength", "Strength", "Close combat, carrying, and hard physical actions."], ["endurance", "Endurance", "Health, recovery, and repeated physical stress."],
    ["reflexes", "Reflexes", "Escaping, firearm handling, and avoiding searches."], ["presence", "Presence", "Negotiation, recruitment, and relationships."],
    ["insight", "Insight", "Trading reads, scouting, and detecting setups."], ["discipline", "Discipline", "Reliability, planning, and crew leadership."],
  ];
  const legacy = C.BACKGROUNDS.find((item) => item.id === state.player.legacyBackground);
  const recent = (state.player.behavior?.history || []).slice(-5).reverse();
  return <><PageHead title="Character" sub="What you brought in, and what the neighborhood currently sees" onBack={onBack} /><div className="scroll">
    <div className="card"><div className="card-title">{state.player.streetName}<small>{identity.label}</small></div><p>{identity.description}</p></div>
    <div className="section-label">Attributes</div>{attributes.map(([id, label, purpose]) => <div className="card compact" key={id}><div className="card-title">{label}<small>{state.player.attributes[id]}</small></div><p className="muted compact">{purpose}</p></div>)}
    <div className="section-label">Derived ratings</div><div className="outcome-grid"><Outcome label="Combat" value={ratings.combat} /><Outcome label="Charisma" value={ratings.charisma} /><Outcome label="Intelligence" value={ratings.intelligence} /></div><p className="muted">Each rating combines multiple attributes; no single number defines what you can do.</p>
    <div className="section-label">Recent reputation</div>{recent.length ? recent.map((entry, index) => <div className="card compact" key={`${entry.sourceId}:${index}`}>{entry.summary}</div>) : <div className="card compact muted">No choice has traveled far enough to become a story yet.</div>}
    {legacy && <div className="card"><div className="card-title">Save history<small>Compatibility</small></div><p>This run began with the {legacy.name} edge before the neighborhood identity system was introduced.</p></div>}
  </div></>;
}

function PhoneScreen({ state, dispatch, onBack, openList }) {
  const today = `Day ${state.run.day} ·`;
  const dayLog = state.log.filter((entry) => entry.stamp.startsWith(today));
  const intel = C.selectors.phoneIntel(state);
  if (!state.phone.active) return <><PageHead title="No Service" sub="The phone stays available even when the network does not" onBack={onBack} /><div className="scroll"><div className="card locked"><div className="card-title">Signal unavailable<small>{state.phone.daysPastDue} days past due</small></div><p>Pay {money(C.PHONE_BILL)} at Night Owl to start restoration. Online payment requires active service and a laptop.</p><button className="btn full primary" disabled={state.player.cash < C.PHONE_BILL} onClick={() => dispatch({ type: "PAY_PHONE_BILL", surface: "store" })}>Pay at Night Owl · {money(C.PHONE_BILL)}<span className="action-copy">Free · service restores after the next action</span></button></div><div className="section-label">Held messages</div><div className="card compact muted">{state.phone.heldInbox.length} message{state.phone.heldInbox.length === 1 ? " is" : "s are"} waiting for service.</div></div></>;
  return <><PageHead title="Phone" sub="Texts, today's log, and word around town" onBack={onBack} /><div className="scroll">
    <div className="section-label">Texts</div>{state.phone.inbox.length ? state.phone.inbox.map((message) => <div className="card compact" key={message.id}><div className="card-title">{message.from}<small>DAY {message.day} · {C.SLOTS[message.slot]}</small></div><p className="compact">{message.text}</p></div>) : <div className="card compact muted">No messages yet.</div>}
    <div className="section-label">Day Log</div>{dayLog.length ? dayLog.map((entry, index) => <div className={`card compact ${entry.tone || ""}`} key={index}>{entry.text}</div>) : <div className="card compact muted">Nothing logged today.</div>}
    <div className="section-label">Word Around Town</div>{intel.map((line, index) => <div className="card compact" key={index}>{line}</div>)}
    {state.knowledge.knows907List && <MenuRow title="907List" status={state.phone.active ? "3 listings" : "No service"} description="Local resale listings." disabled={!state.phone.active} onClick={openList} />}
  </div></>;
}


// `page` and `sub` are owned by the shell so Home can deep-link straight to a
// nested screen (Home → Finances → Debt) in one tap. `subToken` changes on
// every deep link so an identical repeat target still remounts the child on
// its requested page.
function More({ state, dispatch, features, page, setPage, sub, subToken }) {
  if (page === "operations") return <Operations key={`ops:${sub || "root"}:${subToken}`} state={state} dispatch={dispatch} onBack={() => setPage("root")} initialPage={sub} />;
  if (page === "finances") return <Finances key={`fin:${sub || "root"}:${subToken}`} state={state} dispatch={dispatch} onBack={() => setPage("root")} openSafehouse={() => setPage("safehouse")} initialPage={sub} />;
  if (page === "safehouse") return <Safehouse state={state} dispatch={dispatch} onBack={() => setPage("finances")} />;
  if (page === "recovery") return <Recovery state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "character") return <Character state={state} onBack={() => setPage("root")} />;
  if (page === "phone") return <PhoneScreen state={state} dispatch={dispatch} onBack={() => setPage("root")} openList={() => setPage("907list")} />;
  if (page === "907list") return <NineOhSevenList state={state} dispatch={dispatch} surface={sub === "home" ? "home" : "phone"} onBack={() => setPage("root")} />;
  if (page === "help") return <Help marketVisible={state.market.visible} onBack={() => setPage("root")} />;
  const identity = (C.STREET_IDENTITIES[state.player.streetIdentity] || C.STREET_IDENTITIES.unproven).label;
  const opsSummary = features.operations.available ? `${C.selectors.controlledBlockCount(state)} blocks · ${C.selectors.activeSoldierCount(state)} soldiers` : "Locked";
  const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared";
  const daysLeft = hasDreDebt ? state.lender.dueDay - state.run.day : null;
  const financeSummary = !hasDreDebt ? `${money(state.player.cleanCash)} clean` : !state.lender.balance ? "Debt clear" : daysLeft <= 0 ? "Debt due" : `Debt Day ${state.lender.dueDay}`;
  return <><PageHead title="More" sub="Character, progress, finances, and help stay available; property unlocks operations" /><div className="scroll">
    <MenuRow title="Finances" status={financeSummary} description={hasDreDebt ? "Cash, debt, Shark notes, and financial risk." : "Cash and financial risk."} onClick={() => setPage("finances")} />
    {state.knowledge.knows907List && <MenuRow title="907List" status={`${state.nineZeroSevenList.inventory.length}/${C.LISTING_CAPACITY} held`} description="Three two-day phone listings, resale estimates, and a laptop upgrade." disabled={!C.selectors.nineZeroSevenListAccess(state, "phone").available && !C.selectors.nineZeroSevenListAccess(state, "home").available} onClick={() => setPage("907list")} />}
    <MenuRow title="Operations" status={opsSummary} description={features.operations.available ? "Safehouse, territory, soldiers, gear, and Rob." : features.operations.hint} disabled={!features.operations.available} onClick={() => setPage("operations")} />
    {features.recovery.available && <MenuRow title="Recovery" status={`Health ${state.player.health}`} description="Treat injuries or lay low to reduce Heat." onClick={() => setPage("recovery")} />}
    <MenuRow title="Character" status={`${identity} · Respect ${state.npc.curtis.respect}`} description="Street Identity, attributes, derived ratings, and reputation." onClick={() => setPage("character")} />
    <MenuRow title="Help" status="Available" description="Time, trading, major actions, and the dynamic checkpoint." onClick={() => setPage("help")} />
  </div></>;
}

// --- Shared two-layer disclosure components ---------------------------------
// Popups render one layer by default: the mechanical text a player needs right
// now, under 40 words. Everything cut from that layer stays reachable through
// one of two opt-in surfaces, and both are usable anywhere, not only in modals.
//
//   ExpandableMoreSection: situational backstory and atmosphere that belongs
//     to the scene rather than to any one character or place.
//   EntityTooltip / EntityText: recall for a named person or location,
//     attached to the name where it appears in the collapsed text.
let disclosureSeq = 0;
function useDomId(prefix) { const [id] = useState(() => `${prefix}-${++disclosureSeq}`); return id; }

function ExpandableMoreSection({ collapsedContent, expandedContent, moreLabel = "More", lessLabel = "Less", className }) {
  const [open, setOpen] = useState(false);
  const panelId = useDomId("more-panel");
  if (!expandedContent) return <div className={className}>{collapsedContent}</div>;
  return <div className={`expandable${className ? ` ${className}` : ""}`}>
    {collapsedContent}
    <button type="button" className="more-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <span className={`more-chevron${open ? " open" : ""}`} aria-hidden="true" />{open ? lessLabel : moreLabel}
    </button>
    <div className={`more-panel${open ? " open" : ""}`} id={panelId} role="region" aria-label={open ? lessLabel : moreLabel}>
      <div className="more-panel-inner">{expandedContent}</div>
    </div>
  </div>;
}

// Tap target for the name itself, plus the card it opens. The card flips its
// horizontal anchor when opening left-aligned would push it off screen, so it
// stays inside the modal on a phone.
function EntityTooltip({ entityId, displayText, tooltipContent, title }) {
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const cardId = useDomId(`entity-${entityId}`);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!rootRef.current || !rootRef.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    const card = rootRef.current && rootRef.current.querySelector(".entity-card");
    if (card) setFlip(card.getBoundingClientRect().right > window.innerWidth - 8);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return <span className="entity-wrap" ref={rootRef}>
    <button type="button" className={`entity-chip${open ? " open" : ""}`} aria-expanded={open} aria-controls={cardId}
      aria-describedby={open ? cardId : undefined} onClick={() => setOpen(!open)}>{displayText}</button>
    {open && <span className={`entity-card${flip ? " flip" : ""}`} id={cardId} role="dialog" aria-label={title}>
      <b className="entity-card-title">{title}</b>
      <span className="entity-card-body">{tooltipContent}</span>
      <button type="button" className="entity-card-close" onClick={() => setOpen(false)}>Close</button>
    </span>}
  </span>;
}

// Wraps the first mention of each registered entity in a tappable EntityTooltip
// and leaves the rest of the string alone. Aliases are matched longest-first so
// "Curtis Foyer" wins over "Curtis".
const ENTITY_PATTERN = new RegExp(`\\b(${C.ENTITY_MATCH_ORDER.map((entry) => entry.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
const ENTITY_BY_ALIAS = C.ENTITY_MATCH_ORDER.reduce((map, entry) => { map[entry.alias] = entry.id; return map; }, {});
function EntityText({ text }) {
  return useMemo(() => {
    if (!text) return null;
    const seen = {};
    const nodes = [];
    let last = 0;
    ENTITY_PATTERN.lastIndex = 0;
    let match = ENTITY_PATTERN.exec(text);
    while (match) {
      const id = ENTITY_BY_ALIAS[match[1]];
      const entity = C.ENTITY_REGISTRY[id];
      if (entity && !seen[id]) {
        seen[id] = true;
        if (match.index > last) nodes.push(text.slice(last, match.index));
        nodes.push(<EntityTooltip key={`${id}-${match.index}`} entityId={id} displayText={match[1]} title={entity.title} tooltipContent={entity.text} />);
        last = match.index + match[1].length;
      }
      match = ENTITY_PATTERN.exec(text);
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }, [text]);
}

// Standard popup body: collapsed critical text with entity names made tappable,
// and the cut narrative behind one "More" toggle.
function PopupBody({ text, flavor }) {
  return <ExpandableMoreSection
    collapsedContent={<p className="popup-lead"><EntityText text={text} /></p>}
    expandedContent={flavor ? <p className="popup-flavor"><EntityText text={flavor} /></p> : null} />;
}

function Modal({ title, children, onClose, className = "" }) {
  return <div className={`modal-backdrop ${className ? `${className}-backdrop` : ""}`}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-head"><h2>{title}</h2>{onClose && <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>}</div>
    {children}
  </div></div>;
}
function ConfirmPrompt({ title, text, confirmLabel, onConfirm, onCancel }) {
  return <Modal title={title} className="confirm-modal"><p className="popup-lead">{text}</p><div className="btn-row"><button className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" onClick={onConfirm}>{confirmLabel}</button></div></Modal>;
}
function OpeningModal({ dispatch }) {
  return <Modal title="A Spare Room in Spenard">
    <PopupBody
      text="Yalonda gave you a spare room. You have $100, no debt, and no name in the neighborhood beyond the one you brought. Work, move around, and meet people."
      flavor="You came to Alaska to start over. Yalonda rents you a room, and Juan knows the loading docks. Spenard has jobs, a warm counter at the Night Owl, and more doors than you can see from the window." />
    <button className="btn full primary" onClick={() => dispatch({ type: "DISMISS_OPENING" })}>Choose how the first Morning goes<span className="action-copy">No time passes</span></button>
  </Modal>;
}
function TradeModal({ state, productId, dispatch, onClose }) {
  const [mode, setMode] = useState("buy"); const [qty, setQty] = useState(1); const product = C.PRODUCTS.find((item) => item.id === productId); const market = state.world.markets[state.world.currentNeighborhoodId]; const item = state.player.inventory[productId]; const prices = C.selectors.tradeUnitPrices(state, productId); const maxBuy = Math.min(market.availability[productId], C.selectors.cargoCapacity(state) - C.selectors.cargoUsed(state), Math.floor(state.player.cash / prices.buy)); const max = mode === "buy" ? maxBuy : item.qty; const selected = Math.max(0, Math.min(qty, max)); const projection = C.selectors.tradeProjection(state, productId, selected, mode); const resultIsProfit = projection.profitLoss >= 0;
  return <Modal title={`${product.name} trade`}><p>Prices stay locked until you end this market visit.</p><div className="btn-row"><button className={`btn ${mode === "buy" ? "good-btn" : "secondary"}`} onClick={() => { setMode("buy"); setQty(1); }}>Buy</button><button className={`btn ${mode === "sell" ? "primary" : "secondary"}`} onClick={() => { setMode("sell"); setQty(1); }}>Sell</button></div><div className="trade-stats"><div className="trade-stat"><small>Unit price</small><b>{money(projection.unitPrice)}</b></div><div className="trade-stat"><small>Maximum</small><b>{max}</b></div></div><div className="trade-projection" aria-live="polite">{mode === "buy" ? <><Outcome label="Total cost" value={money(projection.purchaseCost)} /><Outcome label="Cash after" value={money(projection.cashAfter)} /><Outcome label="Cargo after" value={`${projection.cargoAfter}/${projection.cargoCapacity}`} />{projection.localContext.available && <div className="trade-context"><span>Recent local context</span><b>{projection.localContext.label}</b></div>}</> : <><Outcome label="Revenue" value={money(projection.revenue)} /><Outcome label="Cost basis" value={money(projection.costBasis)} /><div className={`trade-result ${resultIsProfit ? "profit" : "loss"}`}><span>{resultIsProfit ? "Profit" : "Loss"}</span><b>{signedMoney(projection.profitLoss)}</b></div><Outcome label="Cash after" value={money(projection.cashAfter)} /></>}</div><div className="qty"><button className="btn secondary qty-wide" onClick={() => setQty(Math.max(1, selected - 5))}>−5</button><button className="btn secondary" onClick={() => setQty(Math.max(1, selected - 1))}>−</button><input aria-label="Trade quantity" type="number" min="1" max={max} value={selected} onChange={(event) => setQty(Number(event.target.value))} /><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 1))}>+</button><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 5))}>+5</button><button className="btn secondary" onClick={() => setQty(max)}>MAX</button></div><div className="btn-row trade-confirm"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!selected} onClick={() => { dispatch({ type: mode === "buy" ? "BUY" : "SELL", productId, qty: selected }); onClose(); }}>{mode} {selected}</button></div></Modal>;
}

function CharacterCreation({ dispatch }) {
  const [streetName, setStreetName] = useState("");
  const validName = C.sanitizeStreetName(streetName);
  return <div className="edge-screen"><div className="edge-panel">
    <div className="eyebrow">New run</div>
    <h1>Start from the Bottom</h1>
    <p>Bring a Street Name. The neighborhood decides what it means.</p>
    <div className="street-name">
      <label htmlFor="street-name-input">Street Name</label>
      <input id="street-name-input" className="street-name-field" type="text" autoComplete="off" maxLength={C.STREET_NAME_MAX} placeholder="What do they call you?" value={streetName} onChange={(event) => setStreetName(event.target.value)} />
      <small>Required. Letters, numbers, spaces, apostrophes, periods, and hyphens are accepted.</small>
    </div>
    <button className="edge-card" disabled={!validName} onClick={() => dispatch({ type: "START_RUN", streetName })}><b>Start</b><span>$100 clean cash. No debt. Six equal attributes. The neighborhood decides what comes next.</span><small>Strength · Endurance · Reflexes · Presence · Insight · Discipline</small></button>
  </div></div>;
}
// Collapsed layer is the description alone. Who, Where, Stakes, and the cut
// backstory all sit behind "More" so the default view stays under 40 words and
// the choice buttons stay above the fold on a phone.
function EventModal({ event, dispatch }) {
  const detail = <>
    <div className="outcome-grid"><Outcome label="Who" value={event.who} /><Outcome label="Where" value={event.where} /></div>
    <p className="warn"><b>Stakes:</b> {event.stakes}</p>
    {event.flavor && <p className="popup-flavor"><EntityText text={event.flavor} /></p>}
  </>;
  return <Modal title={event.title}>
    <ExpandableMoreSection collapsedContent={<p className="popup-lead"><EntityText text={event.description} /></p>} expandedContent={detail} />
    {event.choices.map((choice, index) => <button className="btn full choice secondary" key={choice.label} onClick={() => dispatch({ type: "RESOLVE_EVENT", choiceIndex: index })}>{choice.label}<span>{choice.preview}</span></button>)}
  </Modal>;
}
function EncounterModal({ state, dispatch }) {
  const encounter = state.run.pendingEncounter;
  const loot = encounter.loot;
  return <Modal title={encounter.title} className="encounter-modal">
    <PopupBody text={encounter.feedback || encounter.description} flavor={encounter.flavor} />
    {encounter.resolved ? <>
      {loot && <div className="encounter-loot"><span>Recovered</span><b>{loot.label}</b></div>}
      <button className="btn full primary" onClick={() => dispatch({ type: "ACKNOWLEDGE_ENCOUNTER" })}>Continue the run<span className="action-copy">No additional time passes</span></button>
    </> : <div className="encounter-choices">
      {C.selectors.encounterChoices(state).map((choice) => <button className="btn full choice primary" key={choice.id} onClick={() => dispatch({ type: "RESOLVE_ENCOUNTER", choiceId: choice.id })}>{choice.label}<span>{choice.description}</span></button>)}
    </div>}
  </Modal>;
}
function OperationResultModal({ result, dispatch }) {
  const rounds = result.rounds?.length ? <div className="round-log">{result.rounds.map((round) => <div className="card compact" key={round.round}>Round {round.round}: Crew {round.attackTotal} vs Curtis {round.defenseTotal} · <b>{round.winner === "player" ? "crew wins" : "Curtis wins"}</b></div>)}</div> : null;
  return <Modal title={result.title}>
    <ExpandableMoreSection collapsedContent={<p className="popup-lead"><EntityText text={result.summary} /></p>} expandedContent={rounds} moreLabel="Round detail" lessLabel="Hide rounds" />
    <div className="recap">{result.effects.join(" · ")}</div>
    <button className="btn full primary" onClick={() => dispatch({ type: "ACKNOWLEDGE_OPERATION_RESULT" })}>Continue the run</button>
  </Modal>;
}
function EndDayModal({ state, dispatch }) {
  const actions = state.run.dailyActions;
  const collapsed = actions.slice(-3);
  const canExtend = state.player.energy >= 2 && state.run.overtimeUsedDay !== state.run.day;
  return <Modal title="End the day?">
    <ExpandableMoreSection collapsedContent={<><p className="popup-lead">Night is finished. The city has not processed markets, obligations, identity, or tomorrow yet.</p><div className="detail-list">{collapsed.map((entry, index) => <span key={`${entry.label}:${index}`}>{entry.label}</span>)}</div></>} expandedContent={actions.length > collapsed.length ? <div className="detail-list">{actions.map((entry, index) => <span key={`${entry.label}:all:${index}`}>{entry.label}</span>)}</div> : null} moreLabel="Full recap" lessLabel="Short recap" />
    <button className="btn full primary" onClick={() => dispatch({ type: "CONFIRM_END_DAY" })}>End Day {state.run.day}<span className="action-copy">Process the night and continue</span></button>
    {state.run.overtimeUsedDay !== state.run.day && <button className="btn full secondary" disabled={!canExtend} onClick={() => dispatch({ type: "ONE_MORE_THING" })}>One More Thing<span className="action-copy">{canExtend ? "Arm one final action · costs 2 reserve" : "Needs at least 2 reserve"}</span></button>}
  </Modal>;
}
function EndModal({ state, onTitle }) { const summary = C.selectRunSummary(state); const hasDreDebt = state.lender.status === "active" || state.lender.status === "cleared"; return <Modal title={summary.endingLabel}><p className="popup-lead">{summary.streetName} reached the Day {state.run.checkpointDay || state.run.day} checkpoint as {summary.streetIdentityLabel}. This is the operation that survived, and the damage that came with it.</p><div className="outcome-grid"><Outcome label="Operation Score" value={summary.operationScore} /><Outcome label="Net worth" value={money(summary.netWorth)} /><Outcome label="Territories" value={`${summary.territories.filter((item) => item.owner === "player").length}/3`} /><Outcome label="Takeovers" value={`${summary.takeovers.wins}W / ${summary.takeovers.losses}L`} />{hasDreDebt && <Outcome label="Debt" value={money(summary.debt)} />}<Outcome label="Crew" value={summary.crew.length} /></div><div className="recap">{hasDreDebt ? `Dre: ${summary.lenderRelationship}. ` : ""}Curtis: {summary.rivalRelationship}. {summary.majorDecisions.slice(-3).join(" ")}</div><button className="btn full primary" onClick={onTitle}>Return to title</button></Modal>; }
// Two actions plus a close control. Save-slot internals sit behind "More".
function MenuModal({ state, dispatch, onClose, onTitle }) {
  const [confirmRestart, setConfirmRestart] = useState(false);
  function restart() { dispatch({ type: "NEW_RUN", seed: Date.now() }); setConfirmRestart(false); onClose(); }
  return <><Modal title="Run menu" onClose={onClose}>
    <ExpandableMoreSection
      collapsedContent={<p className="popup-lead">Autosave is on. This run saves to your browser after every action.</p>}
      expandedContent={<p className="popup-flavor">907Hustle v1.8 · Seed {state.run.seed} · Core v{state.version} · storage key {C.SAVE_KEY}</p>}
      moreLabel="Save detail" lessLabel="Hide detail" />
    <button className="btn full primary" onClick={onTitle}>Return to Title</button>
    <button className="btn full secondary choice" onClick={() => setConfirmRestart(true)}>Restart Run<span>Creates a new seed and returns to Street Name entry.</span></button>
  </Modal>{confirmRestart && <ConfirmPrompt title="Restart this run?" text="The current autosave will be replaced after you confirm." confirmLabel="Restart Run" onConfirm={restart} onCancel={() => setConfirmRestart(false)} />}</>;
}
// One line by default. The full log is still one tap away, but it no longer
// costs 88px of vertical space on every screen in the game.
function Feed({ entries }) {
  const [open, setOpen] = useState(false);
  const latest = entries[0];
  if (!latest) return null;
  return <div className="feed" aria-label="Street feed">
    <button className="feed-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className={`feed-line ${latest.tone || ""}`}><time>{latest.stamp}</time>{latest.text}</span>
      <span className="feed-more" aria-hidden="true">{open ? "Hide" : "Log"}</span>
    </button>
    {open && <div className="feed-list">{entries.slice(1, 8).map((entry, index) => <div key={index} className={`feed-line ${entry.tone || ""}`}><time>{entry.stamp}</time>{entry.text}</div>)}</div>}
  </div>;
}

// The action-result overlay. This is a system receipt, not a story scene:
// what happened, what it moved, and — loudest of all — the time it cost.
// It auto-dismisses, and a tap anywhere closes it early, so ordinary actions
// never cost an extra deliberate tap.
function ActionResultOverlay({ result, onDismiss }) {
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => { const timer = setTimeout(() => dismissRef.current(), 4200); return () => clearTimeout(timer); }, [result]);
  return <div className="result-backdrop" role="status" aria-live="polite" onClick={onDismiss}>
    <div className="result-card" onClick={(event) => event.stopPropagation()}>
      <div className="result-title">{result.title}</div>
      {result.lines.length > 0 && <div className="result-lines">{result.lines.map((line) => <div className={`result-line ${line.tone}`} key={line.label}><span>{line.label}</span><b>{line.value}</b></div>)}</div>}
      {result.detail && <p className="result-detail">{result.detail}</p>}
      <div className="result-time">{result.time.label}</div>
      <button className="btn full primary" onClick={onDismiss}>Continue</button>
    </div>
  </div>;
}

// Optional host-provided sound hook. The name must differ from this function's
// own: ui.jsx is loaded as type="text/babel", so Babel compiles it as a classic
// script and every top-level declaration becomes a window property. A hook
// named `window.playSound` therefore resolved to this function, and the guard
// below turned into unbounded recursion that unmounted the whole tree on the
// first tab unlock. Regression test: ui-contract.
function playSound(name) {
  if (typeof window !== "undefined" && typeof window.__907sfx === "function") window.__907sfx(name);
}
function TabUnlockedOverlay({ unlock, onDismiss }) {
  const names = { market: "Market", boost: "Boost", rob: "Rob", gambling: "Gambling" };
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    playSound("tabUnlock");
    const timer = setTimeout(() => dismissRef.current(), 2000);
    return () => clearTimeout(timer);
  }, [unlock]);
  return <div className="unlock-backdrop" role="status" aria-live="assertive" onClick={onDismiss}>
    <div className="unlock-card"><span>New access</span><div className="unlock-title">{names[unlock] || unlock} Unlocked</div><small>Tap to continue</small></div>
  </div>;
}

function ConsequencePopup({ items, onDismiss }) {
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const timers = items.map((item, index) => setTimeout(() => dismissRef.current(item.id), 2500 + index * 200));
    return () => timers.forEach(clearTimeout);
  }, [items.map((item) => item.id).join("|")]);
  if (!items.length) return null;
  return <div className="consequence-stack" role="status" aria-live="polite">{items.map((item, index) => <button type="button" className={`consequence-card ${item.tone || ""}`} style={{ animationDelay: `${index * 200}ms` }} key={item.id} onClick={() => onDismiss(item.id)}>{item.text}</button>)}</div>;
}

// Between actions the world was frozen. One line of weather for the block the
// player is standing on, rotating on its own. It reads nothing the player can
// act on and writes nothing back, so it can be ignored entirely.
function AmbientTicker({ state }) {
  const lines = C.selectors.ambientFlavor(state);
  const [index, setIndex] = useState(0);
  const where = `${state.world.currentNeighborhoodId}:${state.run.slot}`;
  useEffect(() => { setIndex(0); }, [where]);
  useEffect(() => {
    if (lines.length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % lines.length), 5000);
    return () => clearInterval(timer);
  }, [where, lines.length]);
  if (!lines.length) return null;
  return <p className="ambient" aria-hidden="true"><span key={`${where}:${index}`}>{lines[index % lines.length]}</span></p>;
}

function nextPartLabel(state) {
  if (state.run.checkpointDay && state.run.day >= state.run.checkpointDay && state.run.slot >= C.SLOTS.length - 1) return "the checkpoint";
  if (state.run.slot >= C.SLOTS.length - 1) return `Day ${state.run.day + 1}, ${C.SLOTS[0]}`;
  return C.SLOTS[state.run.slot + 1];
}

function GameShell({ state, dispatch, onTitle }) {
  // Home is the landing screen for a new or loaded run, and the anchor the
  // player can always get back to in one tap.
  const [nav, setNav] = useState({ tab: "home", more: "root", sub: null, token: 0 });
  const [streetPage, setStreetPage] = useState("root");
  const [hustlePage, setHustlePage] = useState("root");
  const [trade, setTrade] = useState(null); const [menu, setMenu] = useState(false); const [result, setResult] = useState(null);
  const pending = React.useRef(null);
  const features = C.selectors.featureAvailability(state);
  const tab = nav.tab;

  // Every tab change funnels through here, so wrapping this one function gives
  // the whole shell a cross-fade. startViewTransition needs the DOM mutated
  // inside its callback, and React 18 batches by default, so the update is
  // flushed synchronously. Browsers without the API take the plain path and
  // swap instantly, exactly as before.
  function navigate(nextTab, more = "root", sub = null, street = "root") {
    const apply = () => { setNav((prev) => ({ tab: nextTab, more, sub, token: prev.token + 1 })); if (nextTab === "street") setStreetPage(street); if (nextTab === "hustle") setHustlePage(street); };
    if (typeof document === "undefined" || typeof document.startViewTransition !== "function") { apply(); return; }
    // Switching tabs faster than a transition can finish makes the browser
    // abort the in-flight one and reject its promises with InvalidStateError.
    // The navigation itself still lands, so the rejection is noise; left
    // unhandled it surfaces as an uncaught console error.
    const transition = document.startViewTransition(() => ReactDOM.flushSync(apply));
    const ignore = () => {};
    if (transition) { transition.ready?.catch(ignore); transition.finished?.catch(ignore); transition.updateCallbackDone?.catch(ignore); }
  }
  const setTab = (nextTab) => navigate(nextTab);
  const setMorePage = (page) => setNav((prev) => ({ ...prev, more: page, sub: null }));

  // Every dispatch is routed through `act` so the shell can diff the committed
  // state before and after. The reducer is untouched — this is a pure read,
  // and `actionResult` returns null for anything that cost no part of the day.
  function act(action) { pending.current = { type: action.type, before: state }; dispatch(action); }
  useEffect(() => {
    const record = pending.current;
    pending.current = null;
    if (!record || record.before === state) return;
    setResult(C.selectors.actionResult(record.before, state, record.type));
  }, [state]);

  useEffect(() => { if (state.run.pendingEvent || state.run.pendingEncounter || state.run.pendingOperationResult || state.run.status === "ended") setTrade(null); }, [state.run.pendingEvent, state.run.pendingEncounter, state.run.pendingOperationResult, state.run.status]);
  if (state.run.status === "creating_character") return <CharacterCreation dispatch={dispatch} />;
  const navigateMore = () => navigate("more", "finances", "debt");
  const screens = {
    home: <Home state={state} dispatch={act} navigate={navigate} />,
    street: <StreetScreen state={state} dispatch={act} page={streetPage} setPage={setStreetPage} onTrade={setTrade} />,
    hustle: <HustleScreen state={state} dispatch={act} page={hustlePage} setPage={setHustlePage} onTrade={setTrade} />,
    phone: <PhoneScreen state={state} dispatch={act} openList={() => navigate("more", "907list")} />,
    more: <More state={state} dispatch={act} features={features} page={nav.more} setPage={setMorePage} sub={nav.sub} subToken={nav.token} />,
  };
  return <div className="app">
    <Header state={state} onMenu={() => setMenu(true)} />
    <main className="main">{screens[tab]}</main>
    <div>
      <AmbientTicker state={state} />
      <Feed entries={state.log} />
      {((tab === "hustle" && hustlePage === "market") || (tab === "street" && streetPage === "market")) && <div className="action-bar one"><button className="btn primary" onClick={() => act({ type: "END_MARKET" })}>Finish Trading<small>Close this market visit · advance to {nextPartLabel(state)}</small></button></div>}
      {state.run.overtimeArmed && <div className="action-bar one"><button className="btn secondary" onClick={() => act({ type: "CONFIRM_END_DAY" })}>End Day Now<small>Cancel the armed extension and process tonight</small></button></div>}
      <Navigation tab={tab} setTab={setTab} hustleVisible={state.hustle.visible} />
    </div>
    {trade && <TradeModal state={state} productId={trade} dispatch={act} onClose={() => setTrade(null)} />}
    {menu && <MenuModal state={state} dispatch={dispatch} onClose={() => setMenu(false)} onTitle={onTitle} />}
    {state.run.openingPending && <OpeningModal dispatch={act} />}
    {state.run.pendingEncounter && <EncounterModal state={state} dispatch={act} />}
    {!state.run.pendingEncounter && state.run.pendingOperationResult && <OperationResultModal result={state.run.pendingOperationResult} dispatch={act} />}
    {!state.run.pendingEncounter && !state.run.pendingOperationResult && state.run.pendingEvent && <EventModal event={state.run.pendingEvent} dispatch={act} />}
    {!state.run.pendingEncounter && !state.run.pendingOperationResult && !state.run.pendingEvent && state.run.dayEndPending && state.run.status === "playing" && <EndDayModal state={state} dispatch={act} />}
    {state.run.status === "ended" && <EndModal state={state} onTitle={onTitle} />}
    {result && !state.run.dayEndPending && !state.run.pendingEvent && !state.run.pendingEncounter && <ActionResultOverlay result={result} onDismiss={() => setResult(null)} />}
    {state.run.pendingUnlocks[0] && !result && !state.run.openingPending && !state.run.pendingEvent && !state.run.pendingEncounter && !state.run.pendingOperationResult && !state.run.dayEndPending && state.run.status === "playing" && <TabUnlockedOverlay unlock={state.run.pendingUnlocks[0]} onDismiss={() => dispatch({ type: "DISMISS_TAB_UNLOCK" })} />}
    <ConsequencePopup items={state.run.consequenceQueue || []} onDismiss={(id) => dispatch({ type: "DISMISS_CONSEQUENCE", id })} />
  </div>;
}

function App() {
  const [state, dispatch] = useReducer(C.reduceGame, null, () => C.createRun({ seed: Date.now() }));
  const [screen, setScreen] = useState("title"); const [saveInfo, setSaveInfo] = useState(readSave); const [confirmNew, setConfirmNew] = useState(false);
  useEffect(() => { if (screen !== "game") return; try { const serialized = C.serializeRun(state); localStorage.setItem(C.SAVE_KEY, serialized); setSaveInfo(C.inspectSave(serialized)); } catch {} }, [state, screen]);
  function beginNew() { dispatch({ type: "NEW_RUN", seed: Date.now() }); setConfirmNew(false); setScreen("game"); }
  function startNew() { if (saveInfo.valid) { setConfirmNew(true); return; } beginNew(); }
  function loadSaved() { if (!saveInfo.valid) return; dispatch({ type: "HYDRATE_RUN", state: saveInfo.state }); setScreen("game"); }
  function returnToTitle() { setSaveInfo(readSave()); setScreen("title"); }
  return <>{screen === "title" ? <TitleScreen saveInfo={saveInfo} onLoad={loadSaved} onNew={startNew} /> : <GameShell state={state} dispatch={dispatch} onTitle={returnToTitle} />}{confirmNew && <ConfirmPrompt title="Start a new run?" text="The current autosave will be replaced after you confirm." confirmLabel="Start New Run" onConfirm={beginNew} onCancel={() => setConfirmNew(false)} />}</>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
