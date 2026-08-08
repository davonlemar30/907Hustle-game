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
  const severe = /Rook takes|slips back under Rook/.test(state.log[0]?.text || "");
  return <div className={`report-card ${report.tone === "warn" ? (severe ? "severe" : "warn") : "good"}`}><div className="card-title">Eli's Report</div><p>{report.text.replace("Eli's report: ", "")}</p></div>;
}

function readSave() {
  try { return C.inspectSave(localStorage.getItem(C.SAVE_KEY)); }
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
      <div className="sr-only"><h1>907Hustle: One Good Run</h1><p>Seven days. One debt. One good run.</p></div>
      <div className="title-actions">
        {preview && <div className="save-preview" aria-label="Saved run preview"><b>{preview.name}</b><span>Saved run · Day {preview.day} · {preview.part}</span><span>{preview.district} · {money(preview.cash)} cash · {money(preview.debt)} debt</span></div>}
        {saveInfo.error && <div className="save-error" role="alert">{saveInfo.error}</div>}
        <button className="btn full primary title-button" disabled={!saveInfo.valid} onClick={onLoad}>Load Game<span className="action-copy">{saveInfo.valid ? "Resume the exact autosaved run" : "No valid v3 autosave found"}</span></button>
        <button className="btn full secondary title-button" onClick={onNew}>New Game<span className="action-copy">Start a fresh seven-day run</span></button>
        <button className="btn full ghost" aria-expanded={help} onClick={() => setHelp(!help)}>How to Play</button>
        {help && <div className="how-to">
          <b>One week, four parts per day.</b>
          <ExpandableMoreSection
            collapsedContent={<p>Trading inside an open market visit costs no time. Pay Dre $1,200 by Day 7, protect your Health, and decide what the operation is worth by the seventh night.</p>}
            expandedContent={<p className="popup-flavor">Travel, closing the market, recovery, meetings, and major operations each advance you to the next part of day. The four parts are Morning, Afternoon, Evening, and Night.</p>} />
        </div>}
      </div>
    </div>
  </div>;
}

function Hud({ label, value, danger, good }) {
  return <div className={`hud-item${danger ? " danger" : ""}${good ? " good" : ""}`}><span className="k">{label}</span><span className="v">{value}</span></div>;
}
// Secondary-row pressure indicators (Heat/Dre/Respect). Same label={} JSX
// shape as Hud so existing ui-contract token checks still find them, but
// carries its own escalation-tone styling instead of a single danger flag.
function Chip({ label, value, tone }) {
  return <div className={`status-chip${tone ? ` ${tone}` : ""}`}><span className="k">{label}</span><span className="v">{value}</span></div>;
}

function Header({ state, onMenu }) {
  const [open, setOpen] = useState(false);
  const cargo = C.selectors.cargoUsed(state);
  const heat = C.selectors.heatBand(state.player.heat);
  const heatLabel = heat.id === "warm" ? "Building" : heat.label;
  const area = areaOf(state);
  const dreOverdue = state.lender.balance > 0 && state.run.day > state.lender.dueDay;
  const dreDueTonight = state.lender.balance > 0 && state.run.day === state.lender.dueDay;
  const dreValue = !state.lender.balance ? "Clear" : dreDueTonight ? "Due tonight" : dreOverdue ? "Overdue" : money(state.lender.balance);
  // Progressive HUD. The pressure row only renders once something on it is
  // actually applying pressure, so a first-Morning arrival gets one calm line
  // instead of inheriting a Day 6 operator's chrome. Every value stays one tap
  // away in the status drawer, and Home always shows the full situation.
  const showHeat = state.player.heat >= 3;
  const showDebt = state.lender.balance > 0 && state.lender.dueDay - state.run.day <= 2;
  const showRespect = state.rival.respect > 0;
  const showCrew = C.selectors.recruitedCrew(state).length > 0;
  const showRook = state.rival.relationship !== "unaware";
  // The wordmark belongs to the title screen. On a play screen it was a full
  // 50px row of branding above every page, so it is now a screen-reader
  // heading and the Menu button rides the HUD line instead.
  return <header className="top">
    <h1 className="sr-only">907Hustle: One Good Run · v1.1</h1>
    <div className="hud primary-hud">
      <Hud label="Day / Time" value={`${state.run.day}/7 · ${C.SLOTS[state.run.slot]} · ${area.name}`} good />
      <Hud label="Cash" value={money(state.player.cash)} good />
      <button className="status-toggle" aria-expanded={open} aria-label="Show more status" onClick={() => setOpen(!open)}>Status <span>{open ? "Hide" : "View"}</span></button>
      <button className="menu-btn" onClick={onMenu}>Menu</button>
    </div>
    {(showHeat || showDebt || showRespect) && <div className="hud chip-row">
      {showHeat && <Chip label="Heat" value={`${state.player.heat}/15 · ${heatLabel}`} tone={state.player.heat >= 8 ? "escalated" : state.player.heat <= 2 ? "calm" : ""} />}
      {showDebt && <Chip label="Debt" value={dreValue} tone={dreOverdue || dreDueTonight ? "escalated" : !state.lender.balance ? "calm" : ""} />}
      {showRespect && <Chip label="Respect" value={state.rival.respect} tone="" />}
    </div>}
    {open && <div className="hud status-drawer">
      <Hud label="Health" value={`${state.player.health}/100`} danger={state.player.health < 40} />
      <Hud label="Heat" value={`${state.player.heat}/15 · ${heatLabel}`} danger={state.player.heat >= 8} />
      <Hud label="Debt" value={dreValue} danger={dreOverdue || dreDueTonight} />
      <Hud label="Cargo" value={`${cargo}/${C.selectors.cargoCapacity(state)}`} danger={cargo >= C.selectors.cargoCapacity(state)} />
      <Hud label="Respect" value={state.rival.respect} />
      {showCrew && <Hud label="Crew Power" value={C.selectors.crewPower(state, false)} />}
      {showRook && <Hud label="Rook" value={state.rival.relationship} />}
    </div>}
  </header>;
}

// Single-path glyphs, inlined so the bottom bar never waits on a font or an
// external request. Icons carry the tap target; the label names it.
const NAV_ICONS = {
  home: "M12 3 3 10.4V21h6v-6h6v6h6V10.4z",
  market: "M6.2 6h14l-1.7 8.7a2.2 2.2 0 0 1-2.2 1.8H9.4a2.2 2.2 0 0 1-2.2-1.8L5 3.5H1.6v-2H6.6zM9.5 21.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2m7 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2",
  travel: "M12 1.8a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 13.2 7.2 13.2s7.2-7.8 7.2-13.2A7.2 7.2 0 0 0 12 1.8m0 9.9A2.7 2.7 0 1 1 12 6.3a2.7 2.7 0 0 1 0 5.4",
  people: "M9 12a4.1 4.1 0 1 0 0-8.2A4.1 4.1 0 0 0 9 12m0 1.9c-4.1 0-7.4 2.1-7.4 4.7v2.6h14.8v-2.6c0-2.6-3.3-4.7-7.4-4.7m8.8-2.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4m.4 2.1c-.8 0-1.5.1-2.2.3 1.9 1.1 3.1 2.7 3.1 4.4v2.6h5.3v-2.9c0-2.4-2.8-4.4-6.2-4.4",
  more: "M6 12a2.2 2.2 0 1 1-4.4 0A2.2 2.2 0 0 1 6 12m8.2 0a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0m8.2 0a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0",
};
function NavIcon({ id }) { return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={NAV_ICONS[id]} fill="currentColor" /></svg>; }

const NAV = [["home", "Home"], ["market", "Market"], ["travel", "Travel"], ["people", "People"], ["more", "More"]];
function Navigation({ tab, setTab, features, marketVisible }) {
  return <nav className={`nav${marketVisible ? "" : " market-hidden"}`} aria-label="Primary game navigation">{NAV.filter(([id]) => id !== "market" || marketVisible).map(([id, label]) => {
    const enabled = id === "home" || id === "market" || id === "travel" || id === "more" || features[id]?.available;
    return <button key={id} disabled={!enabled} className={tab === id ? "active" : ""} onClick={() => enabled && setTab(id)}><NavIcon id={id} />{label}{!enabled && <small>Locked</small>}</button>;
  })}</nav>;
}
function PageHead({ title, sub, onBack }) { return <div className="page-head">{onBack && <button className="back-btn" onClick={onBack}>← Back</button>}<h1>{title}</h1><p>{sub}</p></div>; }
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
  block_pressure: ["more", "operations", "territory"], soldiers_idle: ["more", "operations", "soldiers"], wages_due: ["people"],
};

// The calmest screen in the game. Where am I, what time is it, what do I have,
// what is pressing, and where might I go — nothing else. Everything below the
// situation block is gated on progression, so Day 1 renders four tiles and a
// sentence while Day 6 renders the organization the player actually built.
function Home({ state, navigate }) {
  const view = C.selectors.homeSituation(state);
  const org = view.organization;
  const showOrgStats = view.unlocks.territory || view.unlocks.soldiers || view.unlocks.district || view.unlocks.rival;
  return <div className="scroll home">
    <div className="home-hero">
      <div className="home-when">Day {view.day} of {view.runDays} · {view.partLabel}</div>
      <h1 className="home-where">{view.districtName}</h1>
      <p className="home-summary">{view.summary}</p>
      <div className="home-identity"><span className="k">Street Identity</span><b>{view.identity.label}</b></div>
    </div>
    <div className="stat-row">
      <StatTile label="Cash" value={money(view.cash)} tone="good" />
      <StatTile label="Health" value={view.health} note="of 100" tone={view.health < 40 ? "bad" : view.health < 70 ? "warn" : ""} />
      <StatTile label="Heat" value={view.heat.label} note={`${view.heat.value} of 15`} tone={view.heat.tone === "good" ? "" : view.heat.tone} text />
      <StatTile label="Debt" value={view.debt.label} note={view.debt.note} tone={view.debt.tone} />
    </div>
    {view.priorities.length > 0 && <>
      <div className="section-label">Needs Attention</div>
      {view.priorities.map((item) => <button key={item.id} className={`priority-row ${item.tone}`} onClick={() => navigate(...(PRIORITY_TARGETS[item.id] || ["home"]))}><span className="menu-row-main"><b>{item.label}</b><small>{item.detail}</small></span><span className="menu-row-arrow" aria-hidden="true">›</span></button>)}
    </>}
    {view.unlocks.operations && <>
      <div className="section-label">Your Operation</div>
      {showOrgStats && <div className="stat-row">
        {view.unlocks.territory && <StatTile label="Blocks" value={`${org.blocks}/${org.blockTotal}`} />}
        {view.unlocks.soldiers && <StatTile label="Soldiers" value={`${org.soldiers}/${org.soldierCapacity}`} />}
        {view.unlocks.district && <StatTile label="District" value={org.district} text />}
        {view.unlocks.rival && <StatTile label="Respect" value={org.respect} />}
      </div>}
      <MenuRow title="Operations" status="Open" description={view.unlocks.territory ? "Territory, soldiers, safehouse, and gear." : "Safehouse, gear, and a quick score."} onClick={() => navigate("more", "operations")} />
    </>}
    <div className="section-label">Manage</div>
    <MenuRow title="Finances" status={view.debt.note} description="Cash, debt, and financial risk." onClick={() => navigate("more", "finances")} />
    {view.unlocks.laundering && <MenuRow title="Laundering" status="Available" description="Turn dirty cash into clean cash." onClick={() => navigate("more", "finances", "laundering")} />}
    {view.unlocks.recovery && <MenuRow title="Recovery" status={`Health ${view.health}`} description="Treat injuries or lay low to cool Heat." onClick={() => navigate("more", "recovery")} />}
  </div>;
}

function Market({ state, onTrade }) {
  const area = areaOf(state); const market = state.world.markets[area.id];
  return <><PageHead title="Street Market" sub={`${area.name} · buy and sell freely; finishing the visit uses one part of day`} /><div className="scroll">
    <div className="market-grid market-head"><span>Product</span><span>Buy</span><span>Signal</span><span>Own</span></div>
    {C.selectors.visibleMarketProducts(state).map((product) => { const open = true; const signal = C.selectors.priceSignal(state, area.id, product.id); const prices = C.selectors.tradeUnitPrices(state, product.id); return <div key={product.id} className={`card product market-grid signal-${signal.id}${open ? "" : " locked"}`} role="button" tabIndex={open ? 0 : -1} onClick={() => open && onTrade(product.id)} onKeyDown={(event) => event.key === "Enter" && open && onTrade(product.id)}>
      <div><div className="product-name">{product.name}</div><div className="role">{open ? `${product.role} · ${market.availability[product.id]} available` : `Locked · ${product.access} access`}</div></div><div className="price">{open ? money(prices.buy) : "—"}</div><div className="signal">{open ? `${signal.symbol} ${signal.label}` : "LOCK"}</div><div className="own">{state.player.inventory[product.id].qty}</div>
    </div>; })}
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
  const available = C.selectors.activityAvailability(state);
  const covered = state.world.transport.weekPass || state.world.transport.dayPassDay === state.run.day;
  const here = state.world.currentNeighborhoodId;
  const knownOf = { north_star_lot: true, downtown: state.world.transport.downtownKnown, airport_industrial: state.world.transport.industrialRouteKnown };
  function go(area) {
    if (area.id === "north_star_lot") { dispatch({ type: covered || state.player.cash >= 5 ? "BUS_TRAVEL" : "WALK_HOME", neighborhoodId: area.id }); setTab("travel"); return; }
    if (area.id === "downtown") { dispatch({ type: "BUS_TRAVEL", neighborhoodId: area.id }); setTab("market"); return; }
    dispatch({ type: "TRAVEL", neighborhoodId: area.id }); setTab("market");
  }
  return <><PageHead title="Destinations" sub="Where do you want to go?" onBack={onBack} /><div className="scroll">
    {C.NEIGHBORHOODS.map((area) => {
      const current = area.id === here;
      const known = knownOf[area.id] || current;
      const walking = area.id === "north_star_lot" && !covered && state.player.cash < 5;
      const access = area.id === "airport_industrial" ? available.industrial : area.id === "downtown" ? available.busDowntown : { available: true, reason: covered ? "Your pass covers this ride." : walking ? "No fare left. You walk and lose 3 Health." : "$5 single ride." };
      const fare = area.id === "north_star_lot" ? (covered ? "Pass covers it" : walking ? "$0 · −3 Health" : "$5") : area.id === "downtown" ? (covered ? "Pass covers it" : "$5") : "Route required";
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

// What can I do without leaving? Work, walking the neighborhood, training,
// the store, and the game — the daily-life layer, kept off the travel page.
function AroundHere({ state, dispatch, onBack }) {
  const [gambleApproach, setGambleApproach] = useState("read");
  const available = C.selectors.activityAvailability(state);
  const area = areaOf(state);
  return <><PageHead title={`Around ${area.name}`} sub="What you can do without leaving the neighborhood" onBack={onBack} /><div className="scroll">
    <PlaceAction title="Ship Creek Freight" status={state.world.locations.employer.standing >= 3 ? "LEGAL COVER" : "DAY LABOR"} purpose="One legitimate freight shift per day. Reliability builds employer standing, and the pay lands as clean cash." cost="$0" time="Morning · one part of day" disabled={!available.work.available} reason={available.work.reason} onClick={() => dispatch({ type: "WORK_SHIFT" })} />
    <PlaceAction title="Explore Spenard" status={state.world.locations.explorationCount ? `${state.world.locations.explorationCount} walks` : "NEW ARRIVAL"} purpose="Learn the neighborhood and discover suppliers, games, routes, and useful local details." cost="$0" time="One part of day" disabled={false} reason={available.explore.reason} onClick={() => dispatch({ type: "EXPLORE_SPENARD" })} />
    <PlaceAction title="Night Owl" status={state.people.mara.met ? "MARA KNOWN" : "OPEN"} purpose="A warm counter, a drink, and a possible first meeting with Mara." cost="Browse free" time="Conversation may use time" disabled={false} reason="Mara's introduction is a first meeting, never a prior routine." onClick={() => dispatch({ type: "VISIT_NIGHT_OWL" })} />
    <div className="card"><div className="card-title">Spenard Community Gym<small>{money(available.gym.cost)} · +{available.gym.progress} progress</small></div><p className="compact">Train one physical attribute. Every session uses one part of day; repeated same-day sessions cost more and give less progress.</p><div className="btn-row">{[["strength", "Strength"], ["endurance", "Endurance"], ["reflexes", "Reflexes"]].map(([id, label]) => <button className="btn secondary" key={id} disabled={!available.gym.available || state.player.attributes[id] >= 5} onClick={() => dispatch({ type: "TRAIN_ATTRIBUTE", attribute: id })}>{label} {state.player.attributes[id]}</button>)}</div><p className="muted compact">Session {available.gym.sessionsToday + 1} today · cost {money(available.gym.cost)} · one part of day</p></div>
    <PlaceAction title="Northern Value" status={`SUSPICION ${state.world.locations.discountStore.suspicion}`} purpose="One small shoplifting opportunity per day. Reflexes lead; Insight, Heat, and remembered suspicion matter." cost="$0" time="One part of day" disabled={!available.shoplifting.available} reason={available.shoplifting.reason} onClick={() => dispatch({ type: "SHOPLIFT" })} />
    {state.world.locations.gamblingKnown && <div className={`card${available.gambling.available ? "" : " locked"}`}><div className="card-title">Informal Game<small>EVENING / NIGHT</small></div><p className="compact">Choose an approach, then risk $20, $50, or $100. Attributes inform the seeded result but never guarantee profit. No debt is offered.</p><select aria-label="Gambling approach" value={gambleApproach} onChange={(event) => setGambleApproach(event.target.value)}><option value="read">Read the room · Insight</option><option value="steady">Play disciplined · Discipline</option><option value="press">Work the table · Presence</option></select><div className="btn-row">{[20, 50, 100].map((stake) => <button className="btn secondary" key={stake} disabled={!available.gambling.available || state.player.cash < stake} onClick={() => dispatch({ type: "GAMBLE", stake, approach: gambleApproach })}>Risk ${stake}</button>)}</div><p className="muted compact">{available.gambling.reason}</p></div>}
  </div></>;
}

// The spare room: storage, house rules, and sleep.
function Household({ state, dispatch, onBack }) {
  const [homeCash, setHomeCash] = useState(100);
  const storedProducts = C.PRODUCTS.reduce((total, product) => total + state.home.storedInventory[product.id].qty, 0);
  const carriedWeapon = C.GEAR.find((item) => item.slot === "weapon" && state.player.gear.owned.includes(item.id));
  return <><PageHead title="Yalonda and John's Home" sub="Temporary shelter with house rules" onBack={onBack} /><div className="scroll">
    <div className={`card${state.people.household.evicted ? " locked" : ""}`}><div className="card-title">House standing<small>{state.people.household.evicted ? "EVICTED" : `${state.people.household.warnings}/3 WARNINGS`}</small></div><p className="compact">Cash is safe here; contraband is not. The room holds at most two product units and one concealable weapon.</p>
      <div className="outcome-grid"><Outcome label="Stored cash" value={money(state.home.storedCash)} /><Outcome label="Stored product" value={`${storedProducts}/2`} /><Outcome label="Hidden weapon" value={state.home.hiddenWeapon ? (C.GEAR.find((item) => item.id === state.home.hiddenWeapon)?.name || state.home.hiddenWeapon) : "None"} /><Outcome label="John's question" value={state.people.household.lastQuestionDay === state.run.day ? "Used today" : "Available"} /></div>
    </div>
    <div className="section-label">Storage</div>
    <div className="card">
      <div className="field-row"><input aria-label="Home cash amount" type="number" min="1" value={homeCash} onChange={(event) => setHomeCash(Math.max(1, Number(event.target.value) || 1))} /><button className="btn secondary" disabled={state.people.household.evicted || homeCash > state.player.cash} onClick={() => dispatch({ type: "HOME_STORE_CASH", amount: homeCash })}>Store cash</button><button className="btn secondary" disabled={state.people.household.evicted || homeCash > state.home.storedCash} onClick={() => dispatch({ type: "HOME_RETRIEVE_CASH", amount: homeCash })}>Retrieve</button></div>
      <div className="btn-row">{C.PRODUCTS.map((product) => <React.Fragment key={product.id}>{state.player.inventory[product.id].qty > 0 && storedProducts < 2 && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_STORE_PRODUCT", productId: product.id, qty: 1 })}>Hide 1 {product.name}</button>}{state.home.storedInventory[product.id].qty > 0 && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_RETRIEVE_PRODUCT", productId: product.id, qty: 1 })}>Take 1 {product.name}</button>}</React.Fragment>)}</div>
      <div className="btn-row">{carriedWeapon && !state.home.hiddenWeapon && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_HIDE_WEAPON", gearId: carriedWeapon.id })}>Hide {carriedWeapon.name}</button>}{state.home.hiddenWeapon && <button className="btn secondary" onClick={() => dispatch({ type: "HOME_RETRIEVE_WEAPON" })}>Take hidden weapon</button>}</div>
    </div>
    <button className="btn full secondary" disabled={state.people.household.evicted || state.people.household.lastQuestionDay === state.run.day} onClick={() => dispatch({ type: "ASK_JOHN" })}>Ask John one local question<span className="action-copy">{state.people.household.lastQuestionDay === state.run.day ? "Already asked today" : "Free · once daily"}</span></button>
    <button className="btn full primary" disabled={state.people.household.evicted} onClick={() => dispatch({ type: "SLEEP_HOME" })}>Sleep at home<span className="action-copy">$0 · uses one part of day</span></button>
  </div></>;
}

// Exploration stores discovery ids; the player never sees an id.
const DISCOVERY_LABELS = { kip_supplier: "A supplier holding weight on a Spenard corner.", informal_game: "An informal card game that runs evenings and nights." };
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

function Travel({ state, dispatch, setTab, page, setPage }) {
  if (page === "destinations") return <Destinations state={state} dispatch={dispatch} setTab={setTab} onBack={() => setPage("root")} />;
  if (page === "transit") return <Transit state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "around") return <AroundHere state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "household") return <Household state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "intel") return <LocalIntel state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "listings") return <Listings state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  const covered = state.world.transport.weekPass || state.world.transport.dayPassDay === state.run.day;
  const area = areaOf(state);
  const available = C.selectors.activityAvailability(state);
  // Local Intel stays hidden until the run has produced intel worth reading,
  // and Listings disappears once the only acquirable property is yours.
  const hasIntel = state.world.locations.explorationCount > 0 || state.world.transport.downtownKnown || state.world.transport.industrialRouteKnown || (state.world.locations.discoveries || []).length > 0;
  return <><PageHead title="Travel" sub="Where to go, how to get there, and what is around you" /><div className="scroll">
    <MenuRow title="Destinations" status={`In ${area.name}`} description="Spenard, Downtown, and the service roads." onClick={() => setPage("destinations")} />
    <MenuRow title={`Around ${area.name}`} status={available.work.available ? "Shift open" : "Open"} description="Work, walk the neighborhood, train, the store, and the game." onClick={() => setPage("around")} />
    {!state.people.household.evicted && <MenuRow title="Home" status={`${state.people.household.warnings}/3 warnings`} description="The spare room: storage, John's question, and sleep." onClick={() => setPage("household")} />}
    <MenuRow title="Transit" status={state.world.transport.weekPass ? "7-day pass" : covered ? "Day pass" : "$5 a ride"} description="People Mover fares and passes." onClick={() => setPage("transit")} />
    {hasIntel && <MenuRow title="Local Intel" status={`${state.world.locations.explorationCount} walks`} description="Known routes, discoveries, and rumors." onClick={() => setPage("intel")} />}
    {!state.base.controlled && <MenuRow title="Listings" status={`${money(C.GARAGE_DEPOSIT)} deposit`} description="North Star Garage and other counters worth a look." onClick={() => setPage("listings")} />}
  </div></>;
}

function SpenardBlockCard({ state, dispatch, block }) {
  const record = state.world.territoryBlocks[block.id]; const revealed = C.selectors.blockIntelVisible(state); const claim = C.selectors.blockClaimAvailability(state, block.id); const soldiers = C.selectors.blockSoldierCount(state, block.id);
  if (record.owner === "player") return <div className="card cleared-card"><div className="card-title">{block.name}<small>CONTROLLED</small></div><p className="compact">{soldiers} soldier{soldiers === 1 ? "" : "s"} posted · {money(record.incomeCollected)} collected so far.</p>{record.lastRaidDay != null && <p className="warn compact">Last raided Day {record.lastRaidDay} · {record.raidCount} raid{record.raidCount === 1 ? "" : "s"} total.</p>}</div>;
  return <div className="card debt-card"><div className="card-title">{block.name}<small>{money(block.claimCost)}</small></div>{revealed ? <p className="compact">Earning {money(block.earningPotential)}/day · Heat exposure {block.heatExposure} · Rook visibility {block.rookVisibility} · patrol {block.patrolFrequency}.</p> : <p className="muted compact">Numbers unconfirmed. Eli's map reveals real stats before you commit.</p>}<button className="btn full secondary" disabled={!claim.available} onClick={() => dispatch({ type: "CLAIM_BLOCK", blockId: block.id })}>Claim block · {money(block.claimCost)}<span className="action-copy">{claim.available ? "Uses one part of day" : claim.reason}</span></button></div>;
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
    <button className="btn full primary" disabled={!recruit.available} onClick={() => dispatch({ type: "RECRUIT_SOLDIER" })}>Recruit a soldier · {money(C.SOLDIER_RECRUIT_COST)}<span className="action-copy">{recruit.available ? "Uses one part of day" : recruit.reason}</span></button>
    {unassigned.length > 0 && automated && <p className="muted compact">Eli is running the {C.ELI_OPERATION_POLICIES[policy]?.label || "Balanced"} order. Available soldiers are placed automatically overnight, no action needed.</p>}
    {unassigned.length > 0 && !automated && <div className="section-label">Assign to a block · Manual policy</div>}
    {unassigned.length > 0 && !automated && unassigned.map((soldier) => <div className="card" key={soldier.id}><div className="card-title">Unassigned soldier<small>Hired Day {soldier.hiredDay}</small></div>{controlledBlocks.length ? <div className="btn-row">{controlledBlocks.map((block) => { const avail = C.selectors.soldierAssignAvailability(state, soldier.id, block.id); return <button className="btn secondary" key={block.id} disabled={!avail.available} onClick={() => dispatch({ type: "ASSIGN_SOLDIER", soldierId: soldier.id, blockId: block.id })}>{block.name}<span className="action-copy">{avail.available ? "Free · no time cost" : avail.reason}</span></button>; })}</div> : <p className="muted compact">Claim a block in Territory before you can post anyone.</p>}</div>)}
  </div></>;
}

function TerritoryCard({ state, dispatch, definition }) {
  const territory = state.world.territories[definition.areaId]; const crewOnly = C.selectors.takeoverReadiness(state, definition.areaId, false); const joined = C.selectors.takeoverReadiness(state, definition.areaId, true); const estimate = C.selectors.territoryPowerEstimate(state, definition.areaId); const name = C.NEIGHBORHOODS.find((area) => area.id === definition.areaId).name;
  const district = C.selectors.districtControlTier(state, definition.areaId);
  if (territory.owner === "player") return <div className="card cleared-card"><div className="card-title">{name}<small>{`DISTRICT CONTROL: ${district.label.toUpperCase()}`}</small></div><p className="compact">{district.hasBlockLayer ? `Income now comes from Territory Blocks, not this district directly.` : `Daily income ${money(definition.dailyIncome)}.`} 4% better buying and selling · risk reduced by 1.</p><p className="muted compact">{definition.special} Total collected: {money(territory.incomeCollected)}.</p></div>;
  return <div className="card debt-card"><div className="card-title">Attack {name}<small>{money(definition.attackCost)} · one part of day</small></div><p className="compact">Your crew Power: <b>{C.selectors.crewPower(state, false)}</b> · Rook estimate: <b>{estimate.label}</b></p><p className="muted compact">Best of three automatic rounds. Ties favor Rook. A loss permanently removes one participating crew member.</p><button className="btn full secondary" disabled={!crewOnly.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: false })}>Send the crew<span className="action-copy">{crewOnly.available ? `Power ${crewOnly.crewPower} · you stay safe` : crewOnly.reason}</span></button><button className="btn full primary choice" disabled={!joined.available} onClick={() => dispatch({ type: "TAKEOVER", neighborhoodId: definition.areaId, includePlayer: true })}>Join the attack<span>Power {C.selectors.crewPower(state, true)} · lose 20–30 Health if the operation fails</span></button></div>;
}

function CrewDetail({ state, dispatch, person, onBack }) {
  const crew = state.people.crew[person.id]; const cost = C.selectors.recruitmentCost(state, person.id); const eliTest = person.id === "eli" ? C.selectors.eliTestRouteAvailability(state) : null;
  const liability = person.id === "eli" ? "A compromised route can add Heat; unpaid wages cut his Power." : person.id === "miri" ? "She expects ownership and may withhold information when treated like a list." : "His methods can raise Heat and provoke Rook.";
  return <><PageHead title={person.name} sub={`${person.role} · Crew Power ${person.power}`} onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Current status<small>{crew.contactStage.replaceAll("_", " ")}</small></div><p>{person.description}</p><div className="detail-list"><span><b>Recruitment:</b> {money(cost)}</span><span><b>Daily wage:</b> {money(person.wage)}</span><span><b>Capacity:</b> 1 of 2 crew spaces</span><span><b>Primary benefit:</b> Power {person.power} and role-specific operation choices</span><span><b>Main liability:</b> {liability}</span><span><b>Hiring time:</b> Uses one part of day at North Star Garage</span></div></div>
    {person.id === "eli" && !crew.recruited && <div className="card"><div className="card-title">Give Eli a Test Route<small>$35 · one part of day</small></div><p className="muted">Fund a small service-road delivery. A clean run can earn modest cash; trouble can cost Health and add Heat. Completing it unlocks recruitment.</p><button className="btn full primary" disabled={!eliTest.available} onClick={() => dispatch({ type: "ELI_TEST_ROUTE" })}>Start the test route<span className="action-copy">{eliTest.reason}</span></button></div>}
    {crew.introduced && !crew.recruited && person.id !== "eli" && <p className="muted">Visit North Star Garage in Operations → Safehouse to recruit.</p>}
    {crew.introduced && !crew.recruited && person.id === "eli" && crew.contactStage === "recruitable" && <button className="btn full good-btn" disabled={!state.base.visiting || state.player.cash < cost || C.selectors.recruitedCrew(state).length >= 2} onClick={() => dispatch({ type: "RECRUIT_CREW", crewId: person.id })}>Recruit Eli · {money(cost)}<span className="action-copy">Uses one part of day at North Star Garage</span></button>}
    {crew.recruited && <div className="card"><p>Active · Loyalty {crew.loyalty} · wages due {money(crew.wageDue)} · assignment {crew.assignment || "none"}</p>{crew.wageDue > 0 && <button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < crew.wageDue} onClick={() => dispatch({ type: "PAY_CREW", crewId: person.id })}>Pay wages · {money(crew.wageDue)}<span className="action-copy">Clears the unpaid Power penalty without advancing time</span></button>}</div>}
    {person.id === "eli" && crew.recruited && (crew.lieutenantStage === "operations_lieutenant" ? <div className="card cleared-card"><div className="card-title">Operations Lieutenant<small>Effectiveness {crew.lieutenantEffectiveness}/3</small></div><p className="compact">Eli places soldiers, rotates corners, and defends territory without a check-in each time.</p>
      {findEliReport(state) && <EliReportCard state={state} />}
      <div className="section-label">Standing order</div>
      <div className="policy-grid" role="radiogroup" aria-label="Eli's standing order">{Object.entries(C.ELI_OPERATION_POLICIES).map(([id, policy]) => <button key={id} role="radio" aria-checked={crew.operationPolicy === id} className={`policy-btn${crew.operationPolicy === id ? " active" : ""}`} onClick={() => dispatch({ type: "SET_ELI_POLICY", policy: id })}><b>{policy.label}</b><span>{policy.description}</span></button>)}</div>
      <p className="muted compact">Changing the order costs no time. {crew.operationPolicy === "manual" ? "Assign soldiers yourself in Soldiers." : "Eli places and redistributes soldiers automatically each night."}</p>
    </div> : (() => { const promo = C.selectors.eliPromotionAvailability(state); return <div className="card"><div className="card-title">Promote to Operations Lieutenant<small>Runs soldiers and corners on their own</small></div><p className="muted compact">Needs Eli's loyalty to reach {C.ELI_LIEUTENANT_UNLOCK.minLoyalty}.</p><button className="btn full primary" disabled={!promo.available} onClick={() => dispatch({ type: "PROMOTE_LIEUTENANT", crewId: "eli" })}>Give Eli Operations<span className="action-copy">{promo.available ? "Uses one part of day" : promo.reason}</span></button></div>; })())}
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
  if (page.startsWith("dealer:")) { const dealer = C.DEALERS.find((item) => item.id === page.split(":")[1]); return <DealerDetail state={state} dispatch={dispatch} dealer={dealer} onBack={() => setPage("dealers")} />; }
  if (page === "dealers") return <><PageHead title="Street Contacts" sub="Corners you can buy from, ask, or take" onBack={() => setPage("root")} /><div className="scroll">{C.DEALERS.map((dealer) => { const record = C.selectors.dealerRecord(state, dealer.id); return <CategoryCard key={dealer.id} title={dealer.name} status={C.selectors.dealerStandingLabel(record)} description={record.known ? `Works ${dealer.where}. Fair business, a straight answer, or a stickup. He remembers which one you chose.` : "Somebody on this block is holding, but you have not met them yet."} disabled={!record.known} onClick={() => setPage(`dealer:${dealer.id}`)} />; })}</div></>;
  if (page.startsWith("crew:")) { const person = C.CREW.find((item) => item.id === page.split(":")[1]); return <CrewDetail state={state} dispatch={dispatch} person={person} onBack={() => setPage("crew")} />; }
  if (page.startsWith("person:")) {
    const id = page.split(":")[1];
    const family = id === "yalonda" ? <div className="card"><div className="card-title">Yalonda<small>Your sister</small></div><p>Warm, protective, and legitimate. She has built a life in Alaska for ten years and will not let your choices destabilize her home.</p><p className="muted">Household status: {state.people.household.evicted ? "You were told to leave" : `${state.people.household.warnings} of 3 warnings`}. Her patience is family trust, not street standing.</p></div> : id === "john" ? <><div className="card"><div className="card-title">John<small>Yalonda's boyfriend · former police</small></div><p>John has lived in Anchorage for twenty years. He knows Dre by reputation from his police years, made the introduction, and warned you not to confuse a loan with friendship.</p></div><button className="btn full secondary" disabled={state.people.household.lastQuestionDay === state.run.day} onClick={() => dispatch({ type: "ASK_JOHN" })}>Ask one local question<span className="action-copy">{state.people.household.lastQuestionDay === state.run.day ? "Already asked today" : "Free information · no time passes"}</span></button></> : null;
    const body = family || (id === "mara" ? <><div className="card"><div className="card-title">Mara Velez<small>Optional personal contact</small></div><p>{state.people.mara.met ? `You met for the first time during her Night Owl shift. The conversation was ${state.people.mara.introChoice || "guarded"}, and later scenes will remember it.` : "Mara is a stranger working the Night Owl. Visit the store if you want to meet her."}</p><p className="muted">Current status: {state.people.mara.status}. Her life and Ship Creek goals remain independent of the operation.</p></div><button className="btn full secondary" disabled={!state.people.mara.met || state.player.cash < 40} onClick={() => dispatch({ type: "VISIT_MARA" })}>Meet after the Night Owl closes · $40<span className="action-copy">Uses one part of day</span></button></> : id === "dre" ? <><div className="card"><div className="card-title">Dre Holloway<small>{state.lender.relationship}</small></div><p>Dre provided $1,000 after John's introduction. His fixed note totals {money(state.lender.balance)} remaining by Day {state.lender.dueDay} Night.</p></div><button className="btn full primary" onClick={() => navigateMore("finances")}>Manage Dre's note</button></> : <div className="card"><div className="card-title">Rook Mercer<small>{state.rival.relationship}</small></div><p>{state.rival.relationship === "unaware" ? "Rook controls parts of the city, but he does not know or care who you are yet." : `Your visible behavior has drawn his attention. Pressure ${state.rival.pressure}; respect ${state.rival.respect}.`}</p></div>);
    const title = id === "yalonda" ? "Yalonda" : id === "john" ? "John" : id === "mara" ? "Mara" : id === "dre" ? "Dre" : "Rook";
    return <><PageHead title={title} sub="Current relationship context" onBack={() => setPage("key")} /><div className="scroll">{body}</div></>;
  }
  if (page === "key") return <><PageHead title="Personal" sub="Family, the lender, and anyone who has entered your life" onBack={() => setPage("root")} /><div className="scroll">
    <MenuRow title="Yalonda" status="Family" description="Your sister, host, and the person enforcing the house rules." onClick={() => setPage("person:yalonda")} />
    <MenuRow title="John" status={state.people.household.lastQuestionDay === state.run.day ? "Asked today" : "Question available"} description="Former police, longtime Anchorage resident, and the person who introduced the lender." onClick={() => setPage("person:john")} />
    {state.people.mara.met && <MenuRow title="Mara Velez" status={state.people.mara.status} description="The Night Owl clerk remembers how your first real conversation went." onClick={() => setPage("person:mara")} />}
    <MenuRow title="Dre Holloway" status={state.lender.relationship} description={`${money(state.lender.balance)} remains on the note due Day ${state.lender.dueDay}.`} onClick={() => setPage("person:dre")} />
    {state.rival.relationship !== "unaware" && <MenuRow title="Rook Mercer" status={state.rival.relationship} description={`His pressure is ${state.rival.pressure}; his crew still owns ${C.TERRITORIES.filter((item) => !C.selectors.controlled(state, item.areaId)).length} districts.`} onClick={() => setPage("person:rook")} />}
  </div></>;
  if (page === "crew") return <><PageHead title="Crew" sub={`${C.selectors.recruitedCrew(state).length}/2 active · introduced contacts, recruitment, wages, and assignments`} onBack={() => setPage("root")} /><div className="scroll">{C.CREW.map((person) => { const crew = state.people.crew[person.id]; return <CategoryCard key={person.id} title={person.name} status={crew.recruited ? `Active · ${money(crew.wageDue)} due` : crew.introduced ? crew.contactStage.replaceAll("_", " ") : "Not introduced"} description={`${person.role} · Power ${person.power}. ${crew.introduced ? person.description : "This contact has not entered the run yet."}`} disabled={!crew.introduced} onClick={() => setPage(`crew:${person.id}`)} />; })}</div></>;
  if (page === "lieutenants") { const lieutenants = C.CREW.filter((person) => person.lieutenantRole && state.people.crew[person.id].recruited); return <><PageHead title="Lieutenants" sub="People running part of the operation without a check-in each time" onBack={() => setPage("root")} /><div className="scroll">{lieutenants.map((person) => { const crew = state.people.crew[person.id]; const status = person.lieutenantRole === "operations" ? (crew.lieutenantStage === "operations_lieutenant" ? `${C.ELI_OPERATION_POLICIES[crew.operationPolicy]?.label || "Balanced"} · Eff ${crew.lieutenantEffectiveness}/3` : "Crew, not yet promoted") : "Finance · laundering active"; return <CategoryCard key={person.id} title={person.name} status={status} description={`${person.lieutenantRole === "operations" ? "Operations" : "Finance"} lieutenant. ${person.description}`} onClick={() => setPage(`crew:${person.id}`)} />; })}</div></>; }
  if (page === "history") return <><PageHead title="Recent History" sub="Choices and callbacks from this run" onBack={() => setPage("root")} /><div className="scroll">{state.stats.majorDecisions.slice().reverse().map((entry, index) => <div className="card compact" key={index}>{entry}</div>)}</div></>;
  const activeLieutenants = C.CREW.filter((person) => person.lieutenantRole && state.people.crew[person.id].recruited);
  const knownDealers = C.DEALERS.filter((item) => state.people.dealers?.[item.id]?.known).length;
  const introducedCrew = C.CREW.filter((person) => state.people.crew[person.id].introduced).length;
  // Categories appear as the run produces people to put in them. An empty
  // "Crew 0/2" row on the first Morning teaches the player nothing.
  return <><PageHead title="People" sub="Personal, street contacts, crew, and lieutenants stay separate" /><div className="scroll">
    <MenuRow title="Personal" status={state.people.mara.met ? "Yalonda · John · Mara · Dre" : "Yalonda · John · Dre"} description="Family, the lender, and anyone else who has entered your life." onClick={() => setPage("key")} />
    {knownDealers > 0 && <MenuRow title="Street Contacts" status={`${knownDealers} known`} description="Corner suppliers. Buy, ask what is moving, or take it off them." onClick={() => setPage("dealers")} />}
    {introducedCrew > 0 && <MenuRow title="Crew" status={`${C.selectors.recruitedCrew(state).length}/${C.selectors.crewCapacityFor(state)} active`} description="Recruitment stages, wages, assignments, and crew capacity." onClick={() => setPage("crew")} />}
    {activeLieutenants.length > 0 && <MenuRow title="Lieutenants" status={`${activeLieutenants.length} active`} description="The people running part of the organization without a check-in." onClick={() => setPage("lieutenants")} />}
    {state.stats.majorDecisions.length > 0 && <MenuRow title="Recent History" status={`${state.stats.majorDecisions.length} decisions`} description="Choices that later scenes may call back." onClick={() => setPage("history")} />}
  </div></>;
}

function QuickScore({ state, dispatch, onBack }) {
  const score = C.selectors.robberyAvailability(state); const stats = state.stats.robbery;
  return <><PageHead title="Quick Score" sub="A risky comeback option; market trading remains the stronger long-term plan" onBack={onBack} /><div className="scroll"><div className="outcome-grid"><Outcome label="Attempts" value={stats.attempts || 0} /><Outcome label="Successes" value={stats.successes || 0} /><Outcome label="Failures" value={stats.failures || 0} /><Outcome label="Total payout" value={money(stats.totalPayout || 0)} /></div><div className="card debt-card"><div className="card-title">Service-road envelope<small>Once each day · one part of day</small></div><p>Take a direct cash risk. Weapons, Combat, Intelligence, crew, and Heat affect the approach. Repeated attempts raise exposure and injury risk.</p><button className="btn full primary" disabled={!score.available} onClick={() => dispatch({ type: "QUICK_SCORE" })}>Attempt today's Quick Score<span className="action-copy">{score.available ? `${score.chanceLabel} estimated success · uses one part of day` : score.reason}</span></button></div></div></>;
}

function Gear({ state, dispatch, onBack }) { return <><PageHead title="Gear" sub="Weapons, armor, tools, utility, and consumables" onBack={onBack} /><div className="scroll">{!state.base.visiting && <p className="warn">Visit North Star Garage in Safehouse before buying gear.</p>}{C.GEAR.map((gear) => { const owned = state.player.gear.owned.includes(gear.id); return <div className="card" key={gear.id}><div className="card-title">{gear.name}<small>{owned ? "EQUIPPED" : money(gear.cost)}</small></div><p className="compact muted">{gear.description}</p><button className="btn full secondary" disabled={!state.base.visiting || state.player.cash < gear.cost || (owned && gear.id !== "medical_kit")} onClick={() => dispatch({ type: "BUY_GEAR", gearId: gear.id })}>{owned ? "Owned" : "Buy"}<span className="action-copy">Uses one part of day</span></button></div>; })}</div></>; }

// Safehouse was the longest page in the build (over five screens of content at
// 320px). It is now a hub: protected cash, storage, upgrades, and assignments
// each get a page that answers one question.
const CREW_ASSIGNMENTS = { eli: [["north_run", "Spenard run"], ["outer_run", "Industrial route"]], miri: [["source_cocaine", "Source Cocaine"], ["source_meth", "Source Meth"]], tone: [["guard_base", "Guard the garage"], ["intimidate_buyer", "Pressure a buyer"]] };

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
    {["security", "storage", "operations", "recovery"].map((track) => { const next = C.BASE_UPGRADES.find((item) => item.track === track && item.level === state.base.tracks[track] + 1); return <div className="card" key={track}><div className="card-title">{track}<small>Level {state.base.tracks[track]}/2</small></div>{next ? <><p className="compact">{next.name} · {money(next.cost)}</p><p className="muted compact">{next.description}</p><button className="btn full secondary" disabled={state.player.cash < next.cost} onClick={() => dispatch({ type: "UPGRADE_BASE", track })}>Install upgrade<span className="action-copy">{state.player.cash < next.cost ? `You need ${money(next.cost - state.player.cash)} more.` : "Uses one part of day"}</span></button></> : <p className="muted compact">Track complete.</p>}</div>; })}
  </div></>;
}

function CrewAssignments({ state, dispatch, onBack }) {
  const fieldCrew = C.selectors.recruitedCrew(state).filter((person) => person.canFieldAssign);
  const network = C.selectors.recruitedCrew(state).filter((person) => !person.canFieldAssign);
  return <><PageHead title="Assignments" sub="Who works with you and what they are doing" onBack={onBack} /><div className="scroll">
    {!fieldCrew.length && !network.length && <p className="muted compact">Nobody works with you yet. Recruit through People → Crew.</p>}
    {fieldCrew.map((person) => { const crew = state.people.crew[person.id]; return <div className="card" key={person.id}><div className="card-title">{person.name}<small>{crew.assignment || "Available"}</small></div>{!crew.assignment && <div className="btn-row">{CREW_ASSIGNMENTS[person.id].map(([id, label]) => <button className="btn secondary" key={id} onClick={() => dispatch({ type: "ASSIGN_CREW", crewId: person.id, assignment: id })}>{label}<span className="action-copy">Uses one part of day</span></button>)}</div>}</div>; })}
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
      <div className="metric-tile"><span className="k">Respect</span><span className="v">{state.rival.respect}</span></div>
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
          const ownState = record.owner === "player" ? "player" : record.owner === "rook" ? "rook" : "unknown";
          const label = record.owner === "player" ? "Controlled" : record.owner === "rook" ? "Rook Held" : "Unclaimed";
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
  if (page === "quick") return <QuickScore state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "territory") return <TerritoryBlocks state={state} dispatch={dispatch} onBack={() => setPage("root")} openDistrict={() => setPage("district")} />;
  if (page === "district") return <DistrictControlPage state={state} dispatch={dispatch} onBack={() => setPage("territory")} />;
  if (page === "soldiers") return <Soldiers state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "gear") return <Gear state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "safehouse") return <Safehouse state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  const score = C.selectors.robberyAvailability(state);
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
    <MenuRow title="Quick Score" status={score.available ? "Available today" : "Unavailable"} description="A risky comeback option when the week turns against you." disabled={!state.base.controlled} onClick={() => setPage("quick")} />
  </div></>;
}

// ---------------------------------------------------------------------------
// Finances. A hub broad enough to absorb future financial systems without a
// redesign: today Overview, Debt & Obligations, Laundering, and Financial Risk.
// ---------------------------------------------------------------------------

function LaunderingPanel({ state, dispatch }) {
  const [amount, setAmount] = useState(0);
  const kip = state.people.crew.kip; const preview = C.selectors.launderAvailability(state, amount);
  if (!kip.recruited) return null;
  return <div className="card"><div className="card-title">Kip's Network<small>{money(preview.remaining)} capacity left today</small></div><p className="muted compact">Kip turns dirty cash into clean cash through six Spenard businesses, keeping a {Math.round(C.KIP_LAUNDER_FEE * 100)}% cut for himself.</p>
    <input aria-label="Launder amount" type="number" min="0" max={state.player.dirtyCash} value={amount || ""} placeholder="Amount to launder" onChange={(event) => setAmount(Math.max(0, Number(event.target.value) || 0))} />
    {preview.available && <div className="launder-flow"><div className="amount dirty"><small>Dirty</small><b>{money(amount)}</b></div><span className="arrow" aria-hidden="true">→</span><div className="amount clean"><small>Clean</small><b>{money(preview.net)}</b></div></div>}
    {preview.available && <p className="muted compact">Kip's fee: {money(preview.fee)} ({Math.round(C.KIP_LAUNDER_FEE * 100)}%)</p>}
    <button className="btn full primary" disabled={!preview.available} onClick={() => { dispatch({ type: "LAUNDER_CASH", amount }); setAmount(0); }}>Launder {money(amount)}<span className="action-copy">{preview.available ? "Uses one part of day" : preview.reason}</span></button>
  </div>;
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
  const [amount, setAmount] = useState(0); const preview = C.selectors.debtPaymentPreview(state, amount); const safe = C.selectors.safeDebtPayment(state);
  function add(value) { setAmount(C.selectors.debtPaymentPreview(state, preview.amount + value).amount); }
  function pay() { if (preview.breaksReserve && !window.confirm(`This leaves less than ${money(C.WORKING_CAPITAL_RESERVE)} in working cash. Pay it anyway?`)) return; dispatch({ type: "PAY_DEBT", amount: preview.amount }); setAmount(0); }
  const fixedTotal = state.run.premise === "fresh_arrival" ? 1200 : state.lender.principal + state.lender.interest;
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
      <button className="btn full primary" disabled={!preview.amount} onClick={pay}>Pay {money(preview.amount)}<span className="action-copy">Uses one part of day</span></button>
    </div>}
  </div></>;
}

function FinancialRisk({ state, openSafehouse }) {
  const heat = C.selectors.heatBand(state.player.heat);
  return <div className="scroll">
    <div className="metric-row">
      <div className="metric-tile"><span className="k">Financial Heat</span><span className="v">{state.player.financialHeat}</span></div>
      <div className="metric-tile"><span className="k">Police Heat</span><span className="v">{state.player.heat}/15 · {heat.label}</span></div>
      <div className="metric-tile dirty"><span className="k">Dirty Exposure</span><span className="v">{money(state.player.dirtyCash)}</span></div>
    </div>
    <div className="card"><div className="card-title">What builds it</div><p className="compact muted">Financial Heat rises when dirty cash pays for things that leave a record: property, upgrades, and large legitimate purchases. Laundering first, or paying with clean cash, keeps the paper trail quiet.</p></div>
    <div className="card"><div className="card-title">Protected cash<small>{money(state.base.storedCash + state.home.storedCash)}</small></div><p className="compact muted">Cash held at the garage or the spare room stays out of reach during raids and stickups.</p><button className="btn full secondary" disabled={!state.base.controlled} onClick={openSafehouse}>Manage protected cash in Safehouse<span className="action-copy">{state.base.controlled ? "No time cost to open the garage list" : "Lease North Star Garage first"}</span></button></div>
  </div>;
}

function Finances({ state, dispatch, onBack, openSafehouse, initialPage }) {
  const [page, setPage] = useState(initialPage || "root");
  if (page === "overview") return <FinanceOverview state={state} onBack={() => setPage("root")} />;
  if (page === "debt") return <DebtPage state={state} dispatch={dispatch} onBack={() => setPage("root")} />;
  if (page === "laundering") return <><PageHead title="Laundering" sub="Turning dirty cash into money you can spend anywhere" onBack={() => setPage("root")} /><div className="scroll"><LaunderingPanel state={state} dispatch={dispatch} /></div></>;
  if (page === "risk") return <><PageHead title="Financial Risk" sub="Financial Heat, exposure, and what is protected" onBack={() => setPage("root")} /><FinancialRisk state={state} openSafehouse={openSafehouse} /></>;
  const daysLeft = state.lender.dueDay - state.run.day;
  const debtStatus = !state.lender.balance ? "Paid in full" : daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due tonight" : daysLeft === 1 ? "Due tomorrow" : `Due Day ${state.lender.dueDay}`;
  // Financial Risk stays hidden until the run has generated any, and
  // Laundering until Kip is actually running finance.
  const showRisk = state.player.financialHeat > 0 || state.people.crew.kip.recruited;
  return <><PageHead title="Finances" sub="Cash, debt, and financial risk across the operation" onBack={onBack} /><div className="scroll">
    <div className="stat-row">
      <StatTile label="Cash" value={money(state.player.cash)} tone="good" />
      <StatTile label="Net Worth" value={money(C.selectors.netWorth(state))} tone={C.selectors.netWorth(state) < 0 ? "bad" : ""} />
    </div>
    <MenuRow title="Overview" status={`${money(state.player.dirtyCash)} dirty`} description="Dirty, clean, protected, net worth, and Financial Heat." onClick={() => setPage("overview")} />
    <MenuRow title="Debt & Obligations" status={debtStatus} description={state.lender.balance ? `${money(state.lender.balance)} remaining. Payment controls and lender detail.` : "The note is clear. History and lender detail."} tone={daysLeft <= 0 && state.lender.balance > 0 ? "bad" : ""} onClick={() => setPage("debt")} />
    {state.people.crew.kip.recruited && <MenuRow title="Laundering" status={`${Math.round(C.KIP_LAUNDER_FEE * 100)}% fee`} description="Convert dirty cash to clean cash through Kip's network." onClick={() => setPage("laundering")} />}
    {showRisk && <MenuRow title="Financial Risk" status={`Financial Heat ${state.player.financialHeat}`} description="Suspicious spending, exposure, and protected cash." onClick={() => setPage("risk")} />}
  </div></>;
}

function Recovery({ state, dispatch, onBack }) {
  const layLow = C.selectors.layLowPreview(state); const doctorOpen = state.base.tracks.recovery >= 2 || state.people.mara.trust >= 3;
  const treatment = (amount, originalCost, name, copy) => { const cost = C.selectors.treatmentCost(state, originalCost); return <div className="card inventory-row" key={name}><div><div className="card-title">{name}</div><div className="muted">{copy} · restore up to {amount} Health</div></div><button className="btn good-btn" disabled={state.player.cash < cost || state.player.health >= 100} onClick={() => dispatch({ type: "HEAL", amount, cost })}>{money(cost)}<span className="action-copy">One part of day</span></button></div>; };
  return <><PageHead title="Recovery" sub="Essential care first; larger options appear when the damage justifies them" onBack={onBack} /><div className="scroll"><div className="card"><div className="card-title">Health<small>{state.player.health}/100</small></div><div className="meter"><span style={{ width: `${state.player.health}%`, background: state.player.health < 40 ? "var(--red)" : "var(--green)" }} /></div></div>{treatment(18, 55, "First aid", "Basic low-cost treatment")}{state.player.health <= 82 && treatment(40, 135, "Clinic visit", "Larger treatment for a serious injury")}{state.player.health <= 55 && (doctorOpen ? treatment(75, 290, "No-Questions Doctor", "Private care unlocked through trust or Safehouse recovery") : <div className="card locked"><div className="card-title">Private medical contact<small>Locked</small></div><p className="muted">Build a trusted medical relationship or install the Safe Room recovery upgrade.</p></div>)}<div className="card"><div className="card-title">Lay Low<small>Next part of day</small></div><p>Expected immediate result: lower Heat by {layLow.heatReduction}. Debt, wages, markets, and Rook continue moving while the lights are off.</p><button className="btn full secondary" onClick={() => dispatch({ type: "LAY_LOW" })}>Lay Low<span className="action-copy">Lowers Heat and advances time</span></button></div></div></>;
}

function Help({ onBack, marketVisible }) { return <><PageHead title="How to Play" sub="The four-part rhythm of One Good Run" onBack={onBack} /><div className="scroll"><div className="card"><h2>Seven days</h2><p>Each day contains Morning, Afternoon, Evening, and Night. Consuming Day 7 Night ends the run.</p></div><div className="card"><h2>Market visits</h2><p>Buy and sell several times at locked prices. Trading does not advance time until you close the visit.</p></div><div className="card"><h2>Major actions</h2><p>Travel, closing the market, recovery, meetings, debt payments, and operations advance to the next part of day. Resolve an event choice without paying a second time cost.</p></div><div className="card"><h2>The week</h2><p>Protect working capital, pay Dre, manage Heat and Health, build relationships, and decide whether territory or a clean exit is worth the risk.</p></div></div></>; }

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
  if (page === "help") return <Help marketVisible={state.market.visible} onBack={() => setPage("root")} />;
  const identity = (C.STREET_IDENTITIES[state.player.streetIdentity] || C.STREET_IDENTITIES.unproven).label;
  const opsSummary = features.operations.available ? `${C.selectors.controlledBlockCount(state)} blocks · ${C.selectors.activeSoldierCount(state)} soldiers` : "Locked";
  const daysLeft = state.lender.dueDay - state.run.day;
  const financeSummary = !state.lender.balance ? "Debt clear" : daysLeft <= 0 ? "Debt due" : `Debt Day ${state.lender.dueDay}`;
  return <><PageHead title="More" sub="Character, progress, finances, and help stay available; property unlocks operations" /><div className="scroll">
    <MenuRow title="Finances" status={financeSummary} description="Cash, debt, laundering, and financial risk." onClick={() => setPage("finances")} />
    <MenuRow title="Operations" status={opsSummary} description={features.operations.available ? "Safehouse, territory, soldiers, gear, and a quick score." : features.operations.hint} disabled={!features.operations.available} onClick={() => setPage("operations")} />
    {features.recovery.available && <MenuRow title="Recovery" status={`Health ${state.player.health}`} description="Treat injuries or lay low to reduce Heat." onClick={() => setPage("recovery")} />}
    <MenuRow title="Character" status={`${identity} · Respect ${state.rival.respect}`} description="Street Identity, attributes, derived ratings, and reputation." onClick={() => setPage("character")} />
    <MenuRow title="Help" status="Available" description="Time, trading, major actions, and the seven-day objective." onClick={() => setPage("help")} />
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
// "Rook Mercer" wins over "Rook".
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

function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop"><div className="modal">
    <div className="modal-head"><h2>{title}</h2>{onClose && <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>}</div>
    {children}
  </div></div>;
}
function OpeningModal({ dispatch }) {
  return <Modal title="A Spare Room and Seven Days">
    <PopupBody
      text="Yalonda gave you one week and a spare room. Dre gave you $1,000. You owe $1,200 by Day 7. No negotiation. The city does not know you yet. Make it count."
      flavor="You came to Alaska to start over. Your sister and her husband John, a former Anchorage officer, connected you with Dre and warned you first that his help comes with sharp edges. The room and the food are free; the money is not. You have honest and dishonest paths forward from their home this Morning." />
    <button className="btn full primary" onClick={() => dispatch({ type: "DISMISS_OPENING" })}>Choose how the first Morning goes<span className="action-copy">No time passes</span></button>
  </Modal>;
}
function TradeModal({ state, productId, dispatch, onClose }) {
  const [mode, setMode] = useState("buy"); const [qty, setQty] = useState(1); const product = C.PRODUCTS.find((item) => item.id === productId); const market = state.world.markets[state.world.currentNeighborhoodId]; const item = state.player.inventory[productId]; const prices = C.selectors.tradeUnitPrices(state, productId); const maxBuy = Math.min(market.availability[productId], C.selectors.cargoCapacity(state) - C.selectors.cargoUsed(state), Math.floor(state.player.cash / prices.buy)); const max = mode === "buy" ? maxBuy : item.qty; const selected = Math.max(0, Math.min(qty, max)); const projection = C.selectors.tradeProjection(state, productId, selected, mode); const resultIsProfit = projection.profitLoss >= 0;
  return <Modal title={`${product.name} trade`}><p>Prices stay locked until you end this market visit.</p><div className="btn-row"><button className={`btn ${mode === "buy" ? "good-btn" : "secondary"}`} onClick={() => { setMode("buy"); setQty(1); }}>Buy</button><button className={`btn ${mode === "sell" ? "primary" : "secondary"}`} onClick={() => { setMode("sell"); setQty(1); }}>Sell</button></div><div className="trade-stats"><div className="trade-stat"><small>Unit price</small><b>{money(projection.unitPrice)}</b></div><div className="trade-stat"><small>Maximum</small><b>{max}</b></div></div><div className="trade-projection" aria-live="polite">{mode === "buy" ? <><Outcome label="Total cost" value={money(projection.purchaseCost)} /><Outcome label="Cash after" value={money(projection.cashAfter)} /><Outcome label="Cargo after" value={`${projection.cargoAfter}/${projection.cargoCapacity}`} />{projection.localContext.available && <div className="trade-context"><span>Recent local context</span><b>{projection.localContext.label}</b></div>}</> : <><Outcome label="Revenue" value={money(projection.revenue)} /><Outcome label="Cost basis" value={money(projection.costBasis)} /><div className={`trade-result ${resultIsProfit ? "profit" : "loss"}`}><span>{resultIsProfit ? "Profit" : "Loss"}</span><b>{signedMoney(projection.profitLoss)}</b></div><Outcome label="Cash after" value={money(projection.cashAfter)} /></>}</div><div className="qty"><button className="btn secondary qty-wide" onClick={() => setQty(Math.max(1, selected - 5))}>−5</button><button className="btn secondary" onClick={() => setQty(Math.max(1, selected - 1))}>−</button><input aria-label="Trade quantity" type="number" min="1" max={max} value={selected} onChange={(event) => setQty(Number(event.target.value))} /><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 1))}>+</button><button className="btn secondary" onClick={() => setQty(Math.min(max, selected + 5))}>+5</button><button className="btn secondary" onClick={() => setQty(max)}>MAX</button></div><div className="btn-row trade-confirm"><button className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!selected} onClick={() => { dispatch({ type: mode === "buy" ? "BUY" : "SELL", productId, qty: selected }); onClose(); }}>{mode} {selected}</button></div></Modal>;
}

function CharacterCreation({ dispatch }) {
  const [streetName, setStreetName] = useState("");
  return <div className="edge-screen"><div className="edge-panel">
    <div className="eyebrow">New run</div>
    <h1>Start from the Bottom</h1>
    <p>You do not choose what the block calls you. The week decides.</p>
    <div className="street-name">
      <label htmlFor="street-name-input">Street Name</label>
      <input id="street-name-input" className="street-name-field" type="text" autoComplete="off" maxLength={C.STREET_NAME_MAX} placeholder="What do they call you?" value={streetName} onChange={(event) => setStreetName(event.target.value)} />
      <small>Optional. Skip it and the week begins as Rookie.</small>
    </div>
    <button className="edge-card" onClick={() => dispatch({ type: "START_RUN", streetName })}><b>Start from the Bottom</b><span>Six equal attributes. No edge. No title. Every activity remains open.</span><small>Strength · Endurance · Reflexes · Presence · Insight · Discipline</small></button>
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
  return <Modal title={encounter.title}>
    <PopupBody text={encounter.feedback || encounter.description} flavor={encounter.flavor} />
    <div className="outcome-grid"><Outcome label="Your Health" value={state.player.health} /><Outcome label="Their resolve" value={encounter.enemyHealth} /></div>
    {C.selectors.encounterChoices(state).map((choice) => <button className="btn full choice primary" key={choice.id} onClick={() => dispatch({ type: "RESOLVE_ENCOUNTER", choiceId: choice.id })}>{choice.label}<span>{choice.description}</span></button>)}
  </Modal>;
}
function OperationResultModal({ result, dispatch }) {
  const rounds = result.rounds?.length ? <div className="round-log">{result.rounds.map((round) => <div className="card compact" key={round.round}>Round {round.round}: Crew {round.attackTotal} vs Rook {round.defenseTotal} · <b>{round.winner === "player" ? "crew wins" : "Rook wins"}</b></div>)}</div> : null;
  return <Modal title={result.title}>
    <ExpandableMoreSection collapsedContent={<p className="popup-lead"><EntityText text={result.summary} /></p>} expandedContent={rounds} moreLabel="Round detail" lessLabel="Hide rounds" />
    <div className="recap">{result.effects.join(" · ")}</div>
    <button className="btn full primary" onClick={() => dispatch({ type: "ACKNOWLEDGE_OPERATION_RESULT" })}>Continue the run</button>
  </Modal>;
}
function DayModal({ summary, dispatch, marketVisible }) { return <Modal title={`End of Day ${summary.day}`}><p>{marketVisible ? "The market closes. " : "The day closes. "}Wages, territory income, debt, and rival pressure have all moved.</p><div className="outcome-grid"><Outcome label="Operation Score" value={summary.operationScore} /><Outcome label="Net worth" value={money(summary.netWorth)} /><Outcome label="Debt" value={money(summary.debt)} /><Outcome label="Heat / Health" value={`${summary.heat} / ${summary.health}`} /></div><button className="btn full primary" onClick={() => dispatch({ type: "DISMISS_DAY_SUMMARY" })}>Start Day {summary.day + 1}</button></Modal>; }
function EndModal({ state, onTitle }) { const summary = C.selectRunSummary(state); return <Modal title={summary.endingLabel}><p className="popup-lead">Seven days as {summary.streetName}, known now as {summary.streetIdentityLabel}. This is the operation that survived, and the damage that came with it.</p><div className="outcome-grid"><Outcome label="Operation Score" value={summary.operationScore} /><Outcome label="Net worth" value={money(summary.netWorth)} /><Outcome label="Territories" value={`${summary.territories.filter((item) => item.owner === "player").length}/3`} /><Outcome label="Takeovers" value={`${summary.takeovers.wins}W / ${summary.takeovers.losses}L`} /><Outcome label="Debt" value={money(summary.debt)} /><Outcome label="Crew" value={summary.crew.length} /></div><div className="recap">Dre: {summary.lenderRelationship}. Rook: {summary.rivalRelationship}. {summary.majorDecisions.slice(-3).join(" ")}</div><button className="btn full primary" onClick={onTitle}>Return to title</button></Modal>; }
// Two actions plus a close control. Save-slot internals sit behind "More".
function MenuModal({ state, dispatch, onClose, onTitle }) {
  function restart() { if (!window.confirm("Restart this run? The current autosave will be replaced after you confirm.")) return; dispatch({ type: "NEW_RUN", seed: Date.now() }); onClose(); }
  return <Modal title="Run menu" onClose={onClose}>
    <ExpandableMoreSection
      collapsedContent={<p className="popup-lead">Autosave is on. This run saves to your browser after every action.</p>}
      expandedContent={<p className="popup-flavor">907Hustle v1.1 · Seed {state.run.seed} · Core v{state.version} · storage key {C.SAVE_KEY}</p>}
      moreLabel="Save detail" lessLabel="Hide detail" />
    <button className="btn full primary" onClick={onTitle}>Return to Title</button>
    <button className="btn full secondary choice" onClick={restart}>Restart Run<span>Creates a new seed and returns to Street Name entry.</span></button>
  </Modal>;
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

function nextPartLabel(state) {
  if (state.run.day >= C.RUN_DAYS && state.run.slot >= C.SLOTS.length - 1) return "the end of the week";
  if (state.run.slot >= C.SLOTS.length - 1) return `Day ${state.run.day + 1}, ${C.SLOTS[0]}`;
  return C.SLOTS[state.run.slot + 1];
}

function GameShell({ state, dispatch, onTitle }) {
  // Home is the landing screen for a new or loaded run, and the anchor the
  // player can always get back to in one tap.
  const [nav, setNav] = useState({ tab: "home", more: "root", sub: null, token: 0 });
  const [travelPage, setTravelPage] = useState("root");
  const [trade, setTrade] = useState(null); const [menu, setMenu] = useState(false); const [result, setResult] = useState(null);
  const pending = React.useRef(null);
  const features = C.selectors.featureAvailability(state);
  const tab = nav.tab;

  function navigate(nextTab, more = "root", sub = null) { setNav((prev) => ({ tab: nextTab, more, sub, token: prev.token + 1 })); setTravelPage("root"); }
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
  useEffect(() => { if (tab === "people" && !features.people.available) setTab(state.market.visible ? "market" : "home"); }, [tab, features.people.available, state.market.visible]);
  useEffect(() => { if (tab === "market" && !state.market.visible) setTab("home"); }, [tab, state.market.visible]);
  if (state.run.status === "creating_character") return <CharacterCreation dispatch={dispatch} />;
  const navigateMore = () => navigate("more", "finances", "debt");
  const screens = {
    home: <Home state={state} navigate={navigate} />,
    market: state.market.visible ? <Market state={state} onTrade={setTrade} /> : null,
    travel: <Travel state={state} dispatch={act} setTab={setTab} page={travelPage} setPage={setTravelPage} />,
    people: <People state={state} dispatch={act} navigateMore={navigateMore} />,
    more: <More state={state} dispatch={act} features={features} page={nav.more} setPage={setMorePage} sub={nav.sub} subToken={nav.token} />,
  };
  return <div className="app">
    <Header state={state} onMenu={() => setMenu(true)} />
    <main className="main">{screens[tab]}</main>
    <div>
      <Feed entries={state.log} />
      {tab === "market" && <div className="action-bar one"><button className="btn primary" onClick={() => act({ type: "END_MARKET" })}>Finish Trading<small>Close this market visit · advance to {nextPartLabel(state)}</small></button></div>}
      <Navigation tab={tab} setTab={setTab} features={features} />
    </div>
    {trade && <TradeModal state={state} productId={trade} dispatch={act} onClose={() => setTrade(null)} />}
    {menu && <MenuModal state={state} dispatch={dispatch} onClose={() => setMenu(false)} onTitle={onTitle} />}
    {state.run.openingPending && <OpeningModal dispatch={act} />}
    {state.run.daySummary && state.run.status === "playing" && <DayModal summary={state.run.daySummary} dispatch={act} marketVisible={state.market.visible} />}
    {!state.run.daySummary && state.run.pendingOperationResult && <OperationResultModal result={state.run.pendingOperationResult} dispatch={act} />}
    {!state.run.daySummary && !state.run.pendingOperationResult && state.run.pendingEvent && <EventModal event={state.run.pendingEvent} dispatch={act} />}
    {!state.run.daySummary && !state.run.pendingOperationResult && state.run.pendingEncounter && <EncounterModal state={state} dispatch={act} />}
    {state.run.status === "ended" && <EndModal state={state} onTitle={onTitle} />}
    {result && <ActionResultOverlay result={result} onDismiss={() => setResult(null)} />}
  </div>;
}

function App() {
  const [state, dispatch] = useReducer(C.reduceGame, null, () => C.createRun({ seed: Date.now() }));
  const [screen, setScreen] = useState("title"); const [saveInfo, setSaveInfo] = useState(readSave);
  useEffect(() => { if (screen !== "game") return; try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(state)); setSaveInfo(C.inspectSave(JSON.stringify(state))); } catch {} }, [state, screen]);
  function startNew() { if (saveInfo.valid && !window.confirm("Start a new run and replace the current autosave?")) return; dispatch({ type: "NEW_RUN", seed: Date.now() }); setScreen("game"); }
  function loadSaved() { if (!saveInfo.valid) return; dispatch({ type: "HYDRATE_RUN", state: saveInfo.state }); setScreen("game"); }
  function returnToTitle() { setSaveInfo(readSave()); setScreen("title"); }
  return screen === "title" ? <TitleScreen saveInfo={saveInfo} onLoad={loadSaved} onNew={startNew} /> : <GameShell state={state} dispatch={dispatch} onTitle={returnToTitle} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
