// Small pure reads over run state, shared by game-core and the event cards.
// They live outside game-core so src/events/cards.js can use them without
// requiring game-core back and creating a cycle.
function checkpointDay(state) { return state.run.checkpointDay || Infinity; }

function controlled(state, areaId) { return state.world.territories[areaId]?.owner === "player"; }

module.exports = {
  checkpointDay,
  controlled,
};
