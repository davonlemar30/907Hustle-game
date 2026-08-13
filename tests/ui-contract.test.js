const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "ui.jsx"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "v05.css"), "utf8");

test("active shell is v1.5 with a packaged title asset and no stale version copy", () => {
  assert.match(ui, /One Good Run · v1\.5/); assert.match(html, /ui\.jsx/); assert.doesNotMatch(html, /legacy-v1-ui-reference|text\/plain/);
  assert.match(ui, /907hustle-title\.png/); assert.ok(fs.existsSync(path.join(root, "assets", "907hustle-title.png")));
  assert.doesNotMatch(ui, /Alpha v0\.9|v0\.9/);
});
test("title screen exposes safe load, new-game confirmation, preview, and help", () => {
  for (const token of ["Load Game", "New Game", "Saved run", "How to Play", "inspectSave", "HYDRATE_RUN", "replace the current autosave"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /screen !== "game"/);
});
test("new games are classless and expose one Start confirmation", () => {
  assert.match(ui, /<b>Start<\/b>/); assert.match(ui, /type: "START_RUN"/); assert.doesNotMatch(ui, /Choose your edge|C\.STARTING_EDGES\.map|C\.BACKGROUNDS\.map/);
});
test("progressive primary navigation leads with Home and keeps Boost after Market", () => {
  assert.match(ui, /const NAV = \[\["home", "Home"\], \["market", "Market"\], \["boost", "Boost"\], \["rob", "Rob"\], \["travel", "Travel"\], \["people", "People"\], \["more", "More"\]\]/);
  for (const label of ["Character", "Operations", "Finances", "Recovery", "Help"]) assert.match(ui, new RegExp(`title="${label}"`));
  assert.match(css, /grid-template-columns:repeat\(5,1fr\)/);
});
test("Travel exposes the fresh-arrival activity and access model", () => {
  for (const token of ["Yalonda and John's Home", "Explore Spenard", "Spenard Jobs", "Spenard Community Gym", "Informal Game", "People Mover", "North Star Garage Listing", "Auto Lot", "Gun Counter"]) assert.ok(ui.includes(token), token);
});

test("Spenard exploration is a discoverable Jobs, Wander, and Contacts submenu", () => {
  for (const token of ["No work found yet", "Wander to look around", 'type: "WANDER_SPENARD"', "Work you found by learning the neighborhood", "Choose a shift approach", "Call, text, or visit"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /contacts\.length > 0 && <MenuRow title="Contacts"/);
  assert.doesNotMatch(ui, /onClick=\{\(\) => dispatch\(\{ type: "EXPLORE_SPENARD" \}\)\}/);
  assert.doesNotMatch(ui, /PlaceAction title="Ship Creek Freight"/);
});
test("HUD shows three primary values and a one-tap status drawer", () => {
  for (const token of ['label="Day / Time"', 'label="Cash"', 'label="Heat"', "status-toggle", 'Chip label="Debt"', "Crew Power"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /aria-expanded=\{open\}/);
});
test("People and Operations use nested full-screen navigation", () => {
  for (const token of ["Personal", "Recent History", "Rob", "Territory", "Gear", "Safehouse", "← Back"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /page\.startsWith\("crew:"\)/); assert.match(ui, /page === "safehouse"/);
});
test("Finance exposes increments, clamped preview, and reserve wording", () => {
  for (const token of ["+$25", "+$50", "+$100", "Safe Maximum", "Pay Full", "Cash remaining", "Debt remaining", "debtPaymentPreview", "Manage protected cash in Safehouse"]) assert.ok(ui.includes(token), token);
});
test("shared trade modal keeps projection parity and hides empty local context", () => {
  for (const token of ["tradeProjection", "Total cost", "Revenue", "Cost basis", "Profit", "Loss", "Cash after", "Cargo after", "signedMoney"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /projection\.localContext\.available &&/); assert.match(css, /trade-result\.profit/); assert.match(css, /trade-result\.loss/);
});
test("player-facing time copy avoids ambiguous slot terminology", () => {
  assert.doesNotMatch(ui, /Costs? 1 slot|one slot|advances exactly one slot/i); assert.match(ui, /part of day/); assert.match(ui, /Morning, Afternoon, Evening, and Night/);
});
test("mobile controls retain 44px targets and reduced-height title handling", () => {
  assert.match(css, /min-height:44px/); assert.match(css, /@media\(max-height:600px\)/); assert.match(css, /height:100dvh/);
});
test("title artwork declares all three aspect tiers and a letterbox backdrop", () => {
  assert.match(css, /@media\(min-aspect-ratio:3\/4\) and \(max-aspect-ratio:1\/1\)/);
  assert.match(css, /@media\(min-aspect-ratio:1\/1\)/);
  assert.match(css, /\.title-backdrop\{display:none\}/);
  assert.match(css, /object-fit:contain/);
  assert.match(ui, /className="title-backdrop"/);
  // Tier A must stay exactly as shipped in v0.6 so mobile does not move.
  assert.match(css, /\.title-art\{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top\}/);
});
test("the market close action names the player action and its destination", () => {
  assert.match(ui, /Finish Trading/);
  assert.doesNotMatch(ui, />End Market</);
  assert.match(ui, /nextPartLabel/);
  assert.match(ui, /Close this market visit/);
});
test("the required Street Name is offered before classless confirmation and shown on the save", () => {
  assert.match(ui, /Street Name/); assert.match(ui, /maxLength=\{C\.STREET_NAME_MAX\}/);
  assert.match(ui, /What do they call you\?/); assert.match(ui, /disabled=\{!validName\}/);
  assert.match(ui, /\{preview\.name\}/); assert.match(ui, /\{summary\.streetName\} reached the Day/);
});
test("Character is nested under More and hides identity internals", () => {
  for (const token of ["function Character", "Strength", "Endurance", "Reflexes", "Presence", "Insight", "Discipline", "Derived ratings", "Recent reputation", "legacyBackground"]) assert.ok(ui.includes(token), token);
  assert.doesNotMatch(ui, /behavior\.scores|pendingIdentityNights|25 percent|raw margin/i);
  assert.equal((ui.match(/\["market", "Market"\]/g) || []).length, 1);
});
test("registry metadata never reaches the presentation layer", () => {
  for (const leak of [/event\.stage/, /event\.cooldown/, /event\.weight/, /event\.requires/, /event\.chain/, /chainStage/]) {
    assert.doesNotMatch(ui, leak, String(leak));
  }
});

// --- v1.1 UI/UX presentation pass -------------------------------------------

test("Operations remains reachable only through More, and the nav highlights More while it is open", () => {
  assert.match(ui, /if \(page === "operations"\) return <Operations/);
  assert.match(ui, /function More\(/);
  // Operations is never rendered by the top-level `screens` tab map, so the
  // active nav tab stays "more" the whole time Operations is on screen —
  // it can never read as "people" while Operations is showing.
  assert.doesNotMatch(ui, /travel: <Operations|people: <Operations|market: <Operations/);
});

test("Territory Blocks and District Control render as visually and textually separate concepts", () => {
  assert.match(ui, /Territory Blocks/);
  assert.match(ui, /District Control/);
  assert.match(ui, /className="territory-board"/);
  assert.match(ui, /className="district-summary"/);
  assert.doesNotMatch(ui, /Territory Blocks · District Control|District Control · Territory Blocks/);
});

test("Eli's standing-order policies render as selectable, labeled controls", () => {
  assert.match(ui, /C\.ELI_OPERATION_POLICIES/);
  assert.match(ui, /className="policy-grid"/);
  assert.match(ui, /className={`policy-btn/);
  assert.match(ui, /role="radio"/);
  assert.match(ui, /SET_ELI_POLICY/);
});

test("Kip never appears in the field-assignable crew list", () => {
  assert.match(ui, /recruitedCrew\(state\)\.filter\(\(person\) => person\.canFieldAssign\)/);
  assert.match(ui, /recruitedCrew\(state\)\.filter\(\(person\) => !person\.canFieldAssign\)/);
});

test("Finances renders dirty, clean, and protected money as distinct metrics", () => {
  assert.match(ui, /metric-tile dirty/);
  assert.match(ui, /metric-tile clean/);
  assert.match(ui, /metric-tile protected/);
  for (const token of ["Dirty", "Clean", "Protected"]) assert.ok(ui.includes(token), token);
});

test("disabled actions carry a reason instead of leaving the player to guess", () => {
  assert.match(ui, /action-copy">\{recruit\.available \? "Uses one part of day" : recruit\.reason\}/);
  assert.match(ui, /action-copy">\{claim\.available \? "Uses one part of day" : claim\.reason\}/);
  assert.match(ui, /action-copy">\{avail\.available \? "Free · no time cost" : avail\.reason\}/);
});

test("status chips exist for Heat and Dre and carry escalation tone classes", () => {
  assert.match(ui, /className="hud chip-row"/);
  assert.match(ui, /tone=\{state\.player\.heat >= 8 \? "escalated" : state\.player\.heat <= 2 \? "calm" : ""\}/);
  assert.match(ui, /tone=\{dreOverdue \|\| dreDueTonight \? "escalated"/);
  assert.match(css, /\.status-chip\.escalated/);
});

test("block ownership state is labeled in text, not signaled by color alone", () => {
  assert.match(ui, /Controlled/);
  assert.match(ui, /Rook Held/);
  assert.match(ui, /Unclaimed/);
  assert.match(ui, /className="node-state"/);
});

test("Finances is a general financial hub, not a Dre-centric debt screen", () => {
  assert.match(ui, /Cash, debt, and financial risk across the operation/);
  assert.match(ui, /Debt & Obligations/);
  assert.match(ui, /Financial Heat/);
  assert.doesNotMatch(ui, /Dre's note · due Day/);
  assert.match(ui, /debt-kicker">Debt/);
});

test("the lender's identity is nested inside the debt detail page, not the persistent HUD or summary", () => {
  assert.match(ui, /function DebtPage\(/);
  assert.match(ui, /Lender: \{state\.lender\.name\}/);
  assert.doesNotMatch(ui, /Chip label="Dre debt"/);
  // The debt hub row and the Home debt tile both describe the obligation, not
  // the person collecting on it.
  assert.match(ui, /title="Debt & Obligations"/);
  assert.doesNotMatch(ui, /Pay Dre \{money/);
});

// --- v1.1 simplification, Home, menus, and action feedback -------------------

test("Home is the residence plus whatever is pressing, and restates nothing", () => {
  assert.match(ui, /function Home\(\{ state, dispatch, navigate \}\)/);
  assert.match(ui, /useState\(\{ tab: "home", more: "root", sub: null, token: 0 \}\)/);
  assert.match(ui, /home: <Home state=\{state\} dispatch=\{act\} navigate=\{navigate\} \/>/);
  for (const token of ["home-hero", "home-summary", "home-identity", "Street Identity", "Needs Attention", "Yalonda and John's"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /C\.selectors\.homeSituation\(state\)/);
  // Home never renders the old dense action bar or a second copy of the log.
  assert.doesNotMatch(ui, /<Feed entries=\{state\.log\} \/>[\s\S]{0,40}home/);
  // The room itself: stash, John, sleep, and the laptop when it is owned.
  const home = ui.slice(ui.indexOf("function Home({ state, dispatch, navigate })"), ui.indexOf("const MARKET_TABLE_MIN"));
  assert.match(home, /MenuRow title="Stash"/);
  assert.match(home, /type: "ASK_JOHN"/);
  assert.match(home, /type: "SLEEP_HOME"/);
  assert.match(home, /MenuRow title="907List Laptop"/);
  assert.match(home, /navigate\("travel", "root", null, "household"\)/);
});

test("Home prints no value the always-visible header is already showing", () => {
  const home = ui.slice(ui.indexOf("function Home({ state, dispatch, navigate })"), ui.indexOf("const MARKET_TABLE_MIN"));
  // Day, time, location and cash are header-only now.
  assert.doesNotMatch(home, /home-when|home-where/);
  assert.doesNotMatch(home, /view\.districtName/);
  assert.doesNotMatch(home, /view\.partLabel/);
  assert.doesNotMatch(home, /StatTile label="Cash"/);
  // Heat and Debt tiles appear only when the header chip row is not carrying
  // them, so the two surfaces can never show the same number at once.
  assert.match(home, /const shown = headerShows\(state\)/);
  assert.match(home, /const showHeatTile = !shown\.heat/);
  assert.match(home, /const showDebtTile = hasDreDebt && !shown\.debt/);
  // Health is only ever in the collapsed drawer, so it keeps its tile.
  assert.match(home, /StatTile label="Health"/);
});

test("systems stay gated, and live in More rather than being restated on Home", () => {
  // v1.6 moved the system shortcuts off Home. Nothing is stranded: More still
  // carries every one of them, and still gates them on the same unlocks.
  const more = ui.slice(ui.indexOf("function More({ state, dispatch, features"), ui.indexOf("function useDomId"));
  assert.match(more, /MenuRow title="Operations"/);
  assert.match(more, /MenuRow title="Recovery"/);
  assert.match(more, /MenuRow title="Finances"/);
  assert.match(more, /MenuRow title="907List"/);
  assert.match(more, /features\.operations\.available/);
  assert.match(more, /features\.recovery\.available/);
  // Laundering is reached through Finances, which owns the panel.
  assert.match(ui, /<LaunderingPanel/);
  const home = ui.slice(ui.indexOf("function Home({ state, dispatch, navigate })"), ui.indexOf("const MARKET_TABLE_MIN"));
  for (const gone of ['MenuRow title="Operations"', 'MenuRow title="Laundering"', 'MenuRow title="Recovery"', 'MenuRow title="Finances"']) {
    assert.ok(!home.includes(gone), `Home should no longer restate ${gone}`);
  }
});

test("the persistent HUD is progressive: pressure chips appear only under pressure", () => {
  assert.match(ui, /const showHeat = state\.player\.heat >= 3/);
  assert.match(ui, /const showDebt = hasDreDebt && state\.lender\.balance > 0 && state\.lender\.dueDay - state\.run\.day <= 2/);
  assert.match(ui, /const showRespect = state\.rival\.respect > 0/);
  // The chip-row condition moved into headerShows so Home can read the same
  // answer and avoid printing a value the header is already carrying.
  assert.match(ui, /function headerShows\(state\)/);
  assert.match(ui, /const chipRow = hasDreDebt && \(heat \|\| debt \|\| respect\)/);
  assert.match(ui, /\{shown\.chipRow && <div className="hud chip-row">/);
});

test("primary navigation is a progressive bottom bar with icons and 44px targets", () => {
  assert.match(ui, /function NavIcon\(/);
  assert.match(ui, /<NavIcon id=\{id\} \/>/);
  assert.match(css, /\.nav\{grid-template-columns:repeat\(5,1fr\)[^}]*border-top:1px solid var\(--line\)[^}]*overflow-x:auto/);
  assert.match(css, /\.nav button\{[^}]*min-height:52px/);
  // Three shell rows now that navigation sits at the bottom edge.
  assert.match(css, /\.app\{grid-template-rows:auto minmax\(0,1fr\) auto;/);
});

test("Travel exposes exactly three root choices with focused subpages", () => {
  for (const fn of ["function Destinations(", "function Transit(", "function AroundHere(", "function Household(", "function LocalIntel("]) assert.ok(ui.includes(fn), fn);
  assert.match(ui, /if \(page === "destinations"\) return <Destinations/);
  const root = ui.slice(ui.indexOf("function Travel("), ui.indexOf("function SpenardBlockCard("));
  assert.equal((root.match(/<MenuRow/g) || []).length, 3);
  for (const title of ["Home", "Leave Spenard"]) assert.match(root, new RegExp(`<MenuRow title="${title}"`));
  assert.match(root, /title=\{`Around \$\{area\.name\}`\}/);
});

test("Leave Spenard combines known destinations, automatic fares, and passes", () => {
  assert.match(ui, /sub="Known destinations and People Mover passes"/);
  assert.match(ui, /C\.NEIGHBORHOODS\.filter\(\(area\) => area\.id !== C\.HOME_DISTRICT_ID\)/);
  assert.match(ui, /const access = C\.selectors\.travelAvailability\(state, area\.id\)/);
  assert.match(ui, /const fare = access\.cashCost \? "\$5" : "Pass covers it"/);
  assert.match(ui, /dispatch\(\{ type: area\.travelAction \|\| "TRAVEL", neighborhoodId: area\.id \}\)/);
  assert.match(ui, /known \? `Risk \$\{area\.risk\}\/5` : "Risk unknown"/);
  assert.match(ui, /known \? `Rival presence \$\{area\.rival\}\/5` : "Rival presence unknown"/);
  assert.match(ui, /const knownOf = \{ north_star_lot: true, downtown: state\.world\.transport\.downtownKnown, airport_industrial: state\.world\.transport\.industrialRouteKnown \}/);
});

test("Operations and Finances are hubs with focused subpages and Back on every one", () => {
  for (const fn of ["function OperationsOverview(", "function DistrictControlPage(", "function TerritoryBlocks(", "function FinanceOverview(", "function DebtPage(", "function FinancialRisk("]) assert.ok(ui.includes(fn), fn);
  for (const page of ["overview", "territory", "district", "soldiers", "gear", "safehouse", "rob"]) assert.match(ui, new RegExp(`page === "${page}"`));
  for (const page of ["overview", "debt", "laundering", "risk"]) assert.match(ui, new RegExp(`page === "${page}"`));
  // Every nested page owns an explicit Back control.
  assert.equal((ui.match(/onBack=\{\(\) => setPage\("root"\)\}/g) || []).length >= 8, true);
});

test("progressive disclosure hides categories that have nothing in them yet", () => {
  assert.match(ui, /knownDealers > 0 && <MenuRow title="Street Contacts"/);
  assert.match(ui, /introducedCrew > 0 && <MenuRow title="Crew"/);
  assert.match(ui, /state\.people\.mara\.met && <MenuRow title="Mara Velez"/);
  assert.match(ui, /state\.rival\.relationship !== "unaware" && <MenuRow title="Rook Mercer"/);
  assert.match(ui, /state\.people\.crew\.kip\.recruited && <MenuRow title="Laundering"/);
  assert.match(ui, /showRisk && <MenuRow title="Financial Risk"/);
  assert.match(ui, /actionOf\("spenard_gambling"\) && <div className=\{`card\$\{available\.gambling\.available/);
  assert.match(ui, /const actions = C\.selectors\.aroundActions\(state\)/);
});

test("every dispatch is routed so the shell can raise an action result", () => {
  assert.match(ui, /function act\(action\) \{ pending\.current = \{ type: action\.type, before: state \}; dispatch\(action\); \}/);
  assert.match(ui, /setResult\(C\.selectors\.actionResult\(record\.before, state, record\.type\)\)/);
  // Screens receive `act`, never the raw reducer dispatch, so no time-consuming
  // action can slip past the result overlay.
  for (const token of ["<Travel state={state} dispatch={act}", "<People state={state} dispatch={act}", "<More state={state} dispatch={act}"]) assert.ok(ui.includes(token), token);
  assert.match(ui, /act\(\{ type: "END_MARKET" \}\)/);
});

test("the action-result overlay stays separate while Night opens the structured recap gate", () => {
  assert.match(ui, /function ActionResultOverlay\(/);
  assert.match(ui, /className="result-title"/);
  assert.match(ui, /className="result-lines"/);
  assert.match(ui, /<div className="result-time">\{result\.time\.label\}<\/div>/);
  assert.match(ui, /setTimeout\(\(\) => dismissRef\.current\(\), 4200\)/);
  assert.match(ui, /function EndDayModal\(\{ state, dispatch \}\)/);
  assert.match(ui, /state\.run\.dailyActions/);
  assert.match(ui, /moreLabel="Full recap"/);
  // Sits above the story modals so dismissing it reveals the scene beneath.
  assert.match(css, /\.result-backdrop\{position:fixed;inset:0;z-index:60/);
  assert.match(css, /\.result-time\{[^}]*color:var\(--amber\)/);
});

test("action results and story events stay separate surfaces", () => {
  // The receipt never carries choices, dialogue, or stakes.
  const overlay = ui.slice(ui.indexOf("function ActionResultOverlay"), ui.indexOf("function nextPartLabel"));
  for (const leak of ["choices", "stakes", "RESOLVE_EVENT", "dialogue"]) assert.ok(!overlay.includes(leak), leak);
  assert.match(ui, /function EventModal\(/);
});

test("the street feed collapses to one line instead of owning 88px of every screen", () => {
  assert.match(ui, /className="feed-toggle"/);
  assert.match(ui, /\{open && <div className="feed-list">/);
  assert.match(css, /\.feed\{max-height:none;overflow:visible;padding:0;border-top:0\}/);
  assert.match(css, /\.feed-toggle\{[^}]*min-height:44px/);
});

test("the market close action is contextual to Market and no longer global chrome", () => {
  assert.match(ui, /tab === "market" && <div className="action-bar one">/);
  assert.doesNotMatch(ui, /className="action-bar two"/);
});

test("Safehouse is a hub instead of the longest page in the build", () => {
  for (const fn of ["function ProtectedCash(", "function SafehouseStorage(", "function BaseUpgrades(", "function CrewAssignments("]) assert.ok(ui.includes(fn), fn);
  assert.match(ui, /<MenuRow title="Protected Cash"/);
  assert.match(ui, /<MenuRow title="Storage"/);
  assert.match(ui, /<MenuRow title="Upgrades"/);
  assert.match(ui, /crewCount > 0 && <MenuRow title="Assignments"/);
  // Protected cash, inventory, four upgrade tracks and assignments no longer
  // stack on one screen.
  assert.doesNotMatch(ui, /Stored inventory · \$\{[\s\S]{0,80}Base upgrades/);
});

test("the play-screen header is one status line, not a wordmark row", () => {
  assert.doesNotMatch(ui, /className="brand-row"/);
  assert.match(ui, /<h1 className="sr-only">907Hustle: One Good Run · v1\.5<\/h1>/);
  assert.match(ui, /<button className="menu-btn" onClick=\{onMenu\}>Menu<\/button>/);
  assert.match(css, /\.primary-hud\{grid-template-columns:minmax\(0,1\.35fr\) minmax\(0,\.72fr\) auto auto/);
});

// --- pre-existing layout bug found by browser QA -----------------------------
// `.app` and the number grids declared bare `1fr` tracks. A bare `1fr` is
// `minmax(auto,1fr)`, and that `auto` floor is the item's min-content width, so
// nowrap HUD/monospace content forced the shell to 687px inside a 320px
// viewport and the whole page scrolled sideways. This reproduced on main.
test("every grid track is clamped so nowrap content cannot force horizontal scroll", () => {
  assert.match(css, /\.app\{grid-template-rows:auto minmax\(0,1fr\) auto;grid-template-columns:minmax\(0,1fr\)\}/);
  for (const rule of [
    /\.outcome-grid,\.trade-stats,\.trade-projection\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,
    /\.payment-preview,\.payment-buttons\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/,
    /\.policy-grid,\.territory-board\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,
  ]) assert.match(css, rule);
  assert.match(css, /\.outcome b,\.trade-stat b,\.trade-result b\{overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  // Earlier declarations in the file still carry the old bare `1fr` tracks;
  // what matters is that the clamped rule is the last one to apply. Assert the
  // cascade order rather than the absence of the original text.
  for (const selector of [".outcome-grid", ".payment-preview", ".policy-grid", ".territory-board", ".trade-projection"]) {
    const decls = [...css.matchAll(new RegExp(`\\${selector}[^{}]*\\{[^}]*grid-template-columns:([^;}]+)`, "g"))];
    assert.ok(decls.length, selector);
    assert.match(decls[decls.length - 1][1], /minmax\(0,/, `${selector} last declaration must clamp its tracks`);
  }
});

// --- v1.2 two-layer popup disclosure ----------------------------------------

test("ExpandableMoreSection is a reusable, accessible, animated disclosure", () => {
  assert.match(ui, /function ExpandableMoreSection\(\{ collapsedContent, expandedContent, moreLabel = "More", lessLabel = "Less"/);
  assert.match(ui, /aria-expanded=\{open\} aria-controls=\{panelId\}/);
  // A <button> gives Enter/Space activation without a keydown handler.
  assert.match(ui, /<button type="button" className="more-toggle"/);
  // Collapsing to nothing when there is no second layer keeps a bare "More"
  // link off popups that have no lore to show.
  assert.match(ui, /if \(!expandedContent\) return/);
  assert.match(css, /\.more-toggle\{[^}]*min-height:44px/);
  assert.match(css, /\.more-panel\{[^}]*transition:grid-template-rows 2\d\dms ease-out\}/);
  assert.match(css, /\.more-panel\.open \.more-panel-inner\{[^}]*max-height:34dvh;overflow-y:auto/);
  assert.match(css, /\.popup-flavor\{[^}]*font-style:italic/);
});

test("EntityTooltip opens per-entity recall from the name itself", () => {
  assert.match(ui, /function EntityTooltip\(\{ entityId, displayText, tooltipContent, title \}\)/);
  assert.match(ui, /aria-describedby=\{open \? cardId : undefined\}/);
  assert.match(ui, /event\.key === "Escape"/);
  assert.match(ui, /document\.addEventListener\("pointerdown", close\)/);
  assert.match(ui, /role="dialog"/);
  assert.match(css, /\.entity-chip\{/);
  assert.match(css, /\.entity-card-close\{[^}]*min-height:44px/);
  // The inline name keeps a 44px tap target through a transparent overlay.
  assert.match(css, /\.entity-chip::after\{[^}]*width:max\(100%,44px\);height:44px\}/);
});

test("registered entity names become tappable once per text block", () => {
  assert.match(ui, /C\.ENTITY_MATCH_ORDER/);
  assert.match(ui, /C\.ENTITY_REGISTRY/);
  assert.match(ui, /if \(entity && !seen\[id\]\)/);
});

test("popup bodies render the collapsed layer plus one optional More layer", () => {
  assert.match(ui, /function PopupBody\(\{ text, flavor \}\)/);
  for (const token of ["<PopupBody", "EntityText text={event.description}", "EntityText text={event.flavor}"]) assert.ok(ui.includes(token), token);
  // The opening beat leads with the Week Zero numbers and hides the arrival backstory.
  assert.match(ui, /You have \$100, no debt, and no name in the neighborhood/);
  assert.doesNotMatch(ui, /You came to Alaska to start over, stay briefly/);
});

test("run menu offers two actions plus a close control", () => {
  const menu = ui.slice(ui.indexOf("function MenuModal"), ui.indexOf("function Feed"));
  assert.equal((menu.match(/className="btn full/g) || []).length, 2);
  assert.match(menu, /<Modal title="Run menu" onClose=\{onClose\}>/);
  assert.match(ui, /className="modal-close"/);
  assert.match(css, /\.modal-close\{[^}]*min-height:44px/);
});

test("player-facing modal copy carries no em dashes or vague intensifiers", () => {
  const modalLayer = ui.slice(ui.indexOf("function Modal("), ui.indexOf("function Feed("));
  assert.doesNotMatch(modalLayer, /[—–]/);
  assert.doesNotMatch(modalLayer, /\b(really|very|truly|actually|basically|literally)\b/i);
});

test("encounters are narrative-first, acknowledge results, and fit the 320px mobile shell", () => {
  const encounter = ui.slice(ui.indexOf("function EncounterModal"), ui.indexOf("function OperationResultModal"));
  assert.match(html, /encounters\.js[\s\S]*game-core\.js/);
  assert.match(encounter, /ACKNOWLEDGE_ENCOUNTER/);
  assert.match(encounter, /encounter\.loot/);
  assert.doesNotMatch(encounter, /Their resolve|enemyHealth|Your Health/);
  assert.match(css, /\.encounter-modal\{[^}]*overflow-x:hidden/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /\.encounter-modal-backdrop\{[^}]*z-index:58/);
});

// --- v1.6 UX audit fixes -------------------------------------------------

test("no top-level ui.jsx function delegates to a window property of its own name", () => {
  // ui.jsx loads as type="text/babel", so Babel compiles it as a classic
  // script and every top-level declaration becomes a window property. A hook
  // named after its own function therefore resolves to itself and recurses
  // until the stack blows. This shipped as `playSound` and unmounted the whole
  // tree on the first tab unlock, which also bricked the autosave.
  const declarations = [...ui.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1]);
  assert.ok(declarations.length > 20, "expected to find the top-level function declarations");
  for (const name of declarations) {
    assert.doesNotMatch(ui, new RegExp(`window\\.${name}\\s*\\(`), `${name} calls window.${name}, which is itself`);
    assert.doesNotMatch(ui, new RegExp(`typeof window\\.${name}\\s*===`), `${name} probes window.${name}, which is itself`);
  }
  assert.match(ui, /typeof window\.__907sfx === "function"/);
});

test("page header lays the back button beside the title block instead of floating it", () => {
  // float:left with no clearfix dropped the second line of a wrapped subtitle
  // under the button and outside the header band.
  assert.match(ui, /<div className="page-head-text"><h1>\{title\}<\/h1><p>\{sub\}<\/p><\/div>/);
  assert.match(css, /\.page-head\{display:flex/);
  assert.match(css, /\.back-btn\{float:none/);
  assert.match(css, /\.page-head-text\{flex:1;min-width:0\}/);
});

test("the HUD carries four time-slot pips with a reduced-motion fallback", () => {
  assert.match(ui, /function SlotPips\(\{ slot \}\)/);
  assert.match(ui, /<SlotPips slot=\{state\.run\.slot\} \/>/);
  assert.match(ui, /className="slot-pips" aria-hidden="true"/);
  assert.match(css, /\.slot-pip\{[^}]*border-radius:50%/);
  assert.match(css, /@media\(prefers-reduced-motion:no-preference\)\{\.slot-pip\.now\{animation:pip-breathe/);
});

test("a sparse market renders cards and a dense one keeps the table", () => {
  const market = ui.slice(ui.indexOf("const MARKET_TABLE_MIN"), ui.indexOf("function Boost("));
  assert.match(market, /const MARKET_TABLE_MIN = 3/);
  assert.match(market, /const compact = products\.length < MARKET_TABLE_MIN/);
  assert.match(market, /\{!compact && <div className="market-grid market-head">/);
  assert.match(css, /\.product-card\{/);
});

test("the travel root offers a quick shift once the player has worked one", () => {
  const travel = ui.slice(ui.indexOf("function Travel("), ui.indexOf("function SpenardBlockCard"));
  assert.match(travel, /C\.selectors\.quickShift\(state\)/);
  assert.match(travel, /setPage\(`around:job:\$\{shift\.jobId\}`\)/);
  assert.match(ui, /initialPage = "root"/);
  assert.match(css, /\.quick-shift\{/);
});

test("HUD value changes flash only after an in-session change", () => {
  assert.match(ui, /function useValueFlash\(value\)/);
  // The first render seeds the previous value without reporting, so loading a
  // save never flashes a full run's worth of numbers at the player.
  assert.match(ui, /if \(!seeded\.current\) \{ seeded\.current = true; previous\.current = value; return; \}/);
  assert.match(ui, /const cashFlash = cashMove === "up" \? "good" : cashMove === "down" \? "bad" : null/);
  assert.match(ui, /const heatFlash = heatMove === "up" \? "warn" : null/);
  assert.match(ui, /const healthFlash = healthMove === "down" \? "bad" : null/);
  assert.match(css, /\.hud-item\[data-flash="good"\]\{animation:flash-good/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\n\s*\.hud-item\[data-flash\],\.status-chip\[data-flash\]\{animation:none\}/);
});

test("tab navigation goes through one view-transition funnel and degrades", () => {
  assert.match(ui, /typeof document\.startViewTransition !== "function"\) \{ apply\(\); return; \}/);
  assert.match(ui, /document\.startViewTransition\(\(\) => ReactDOM\.flushSync\(apply\)\)/);
  assert.match(css, /::view-transition-old\(root\)/);
  assert.match(css, /::view-transition-new\(root\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\n\s*::view-transition-old\(root\),::view-transition-new\(root\)\{animation:none\}/);
});

test("the ambient ticker is decorative, location-aware, and never overlaps the nav", () => {
  assert.match(ui, /function AmbientTicker\(\{ state \}\)/);
  assert.match(ui, /C\.selectors\.ambientFlavor\(state\)/);
  assert.match(ui, /className="ambient" aria-hidden="true"/);
  // Rendered inside the bottom block, above the feed, so it shares the shell
  // row that already holds the action bar and nav instead of floating over it.
  assert.match(ui, /<AmbientTicker state=\{state\} \/>\n\s*<Feed entries=\{state\.log\} \/>/);
  assert.doesNotMatch(ui, /AmbientTicker[\s\S]{0,400}dispatch/);
  const ambientRule = css.match(/\.ambient\{[^}]*\}/)[0];
  assert.doesNotMatch(ambientRule, /position:fixed|position:absolute/, "the ticker stays in flow so it cannot cover the action bar");
  assert.match(ambientRule, /overflow:hidden/);
  assert.match(ambientRule, /white-space:nowrap/);
});

test("ambient flavor copy follows the house writing rules", () => {
  const core = fs.readFileSync(path.join(root, "game-core.js"), "utf8");
  const registry = core.slice(core.indexOf("const AMBIENT_FLAVOR = {"), core.indexOf("function ambientFlavor(state)"));
  const lines = [...registry.matchAll(/^\s*"([^"]+)",$/gm)].map((match) => match[1]);
  assert.ok(lines.length >= 90, `expected a full registry, found ${lines.length} lines`);
  for (const line of lines) {
    assert.doesNotMatch(line, /[—–]/, `em dash: ${line}`);
    assert.doesNotMatch(line, /\b(real|really|very|truly|actually|basically|literally)\b/i, `vague intensifier: ${line}`);
    assert.doesNotMatch(line, /\bnot\b[^.]*\bbut\b/i, `negation pivot: ${line}`);
    assert.ok(line.split(/\s+/).length < 40, `over 40 words: ${line}`);
  }
});

test("every neighborhood has an ambient pool for all four parts of day", () => {
  const C = require("../game-core.js");
  for (const area of C.NEIGHBORHOODS) {
    for (let slot = 0; slot < C.SLOTS.length; slot += 1) {
      const state = { world: { currentNeighborhoodId: area.id }, run: { slot } };
      const pool = C.selectors.ambientFlavor(state);
      assert.ok(pool.length >= 8, `${area.id} slot ${slot} has ${pool.length} lines`);
      assert.equal(new Set(pool).size, pool.length, `${area.id} slot ${slot} repeats a line`);
    }
  }
});
