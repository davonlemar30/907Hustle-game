// Six bands, shared by every NPC.
//
// Before this, each character carried its own threshold vocabulary: Mina gated
// on trust >= 3, Curtis on attention >= 4 and respect >= 5, Dre on trust >= 1.
// Nothing checked that those numbers meant comparable things, because they did
// not. A band is the shared unit. Content asks "is this person at least Warm
// with me", and the lens decides what Warm took.
//
// Bands are ordered integers so a gate can be a single >= comparison.

const BANDS = {
  HOSTILE: 0,
  COLD: 1,
  NEUTRAL: 2,
  WARM: 3,
  TRUSTED: 4,
  BONDED: 5,
};

const BAND_IDS = ["hostile", "cold", "neutral", "warm", "trusted", "bonded"];

const BAND_LABELS = {
  hostile: "Hostile",
  cold: "Cold",
  neutral: "Neutral",
  warm: "Warm",
  trusted: "Trusted",
  bonded: "Bonded",
};

// Floors are inclusive and checked from the top down. Score -5 is Cold, -6 is
// Hostile, 6 is Trusted, 9 is Bonded. Scores are floats, so these are the only
// boundary values that matter.
const BAND_FLOORS = [
  [BANDS.BONDED, 9],
  [BANDS.TRUSTED, 6],
  [BANDS.WARM, 3],
  [BANDS.NEUTRAL, 0],
  [BANDS.COLD, -5],
];

function bandFor(score) {
  const value = Number(score) || 0;
  for (const [band, floor] of BAND_FLOORS) if (value >= floor) return band;
  return BANDS.HOSTILE;
}

function bandId(band) {
  return BAND_IDS[band] || BAND_IDS[BANDS.NEUTRAL];
}

function bandLabel(band) {
  return BAND_LABELS[bandId(band)];
}

module.exports = { BANDS, BAND_IDS, BAND_LABELS, BAND_FLOORS, bandFor, bandId, bandLabel };
