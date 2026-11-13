/**
 * Tiered hints and recorded par solutions (verified by tools/solve.js).
 */
(function (root) {
  const HINTS = {
    "threshold": {
      tiers: [
        "This room is just a walk. The word DOOR is the way out.",
        "Swipe toward the door, or tap a tile next to you. You can turn on the D-pad in the menu.",
        "Walk right, all the way into DOOR.",
      ],
      solution: ["R", "R", "R", "R", "R", "R", "R", "R", "R", "R", "R"],
    },
    "unsay": {
      tiers: [
        "A WALL stands in the way. You can unsay it.",
        "Tap the word WALL at the bottom, then Speak. Every WALL on the page will leave.",
        "Walk up to the wall, say WALL, then walk through to the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:WALL", "R", "R", "R", "R", "R", "R"],
    },
    "inside": {
      tiers: [
        "You cannot say WALL this time. Listen to what WALL contains.",
        "ALL is inside WALL. Saying ALL unsays every word that holds it.",
        "Say ALL. The wall will go with it. Then walk to the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:ALL", "R", "R", "R", "R", "R", "R"],
    },
    "careful": {
      tiers: [
        "You have one breath and two words. One of them is a mistake.",
        "OR lives inside DOOR. If you say OR, the door itself will leave.",
        "Say ALL, not OR, then walk to the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:ALL", "R", "R", "R", "R", "R", "R"],
    },
    "latch": {
      tiers: [
        "A wall and a lock. You have two breaths.",
        "Say ALL to unsay the wall, then say LOCK to unsay the latch.",
        "ALL, then LOCK, then walk to the door. Do not waste a breath.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:ALL", "R", "R", "R", "SAY:LOCK", "R", "R", "R"],
    },
    "river": {
      tiers: [
        "You cannot stand on WATER. It has to be unsaid.",
        "OR would unsay the door. Use your only breath on the river.",
        "Say WATER, then walk across to the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:WATER", "R", "R", "R", "R", "R", "R"],
    },
    "crossing": {
      tiers: [
        "The bridge does not reach the far bank. The river still does.",
        "If you unsay BRIDGE, the water remains. Unsay the water instead.",
        "Say WATER, then walk down to the door. Leave the bridge alone.",
      ],
      solution: ["R", "R", "R", "R", "R", "R", "R", "R", "R", "R", "SAY:WATER", "D", "D"],
    },
    "stepping": {
      tiers: [
        "A stone will hold you above the water. A lock still waits on the far side.",
        "CK lives in both ROCK and LOCK. If you say CK, the stone goes too.",
        "Cross on the rock, say LOCK only, then walk down to the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "R", "R", "D", "SAY:LOCK", "D", "D", "R", "R", "R"],
    },
    "narrow": {
      tiers: [
        "A wall, then water, then the door. Two breaths, and no room to step around.",
        "Say ALL for the wall, say WATER for the river.",
        "Speak ALL, step down, speak WATER, and walk into the door.",
      ],
      solution: ["SAY:ALL", "D", "SAY:WATER", "D", "D"],
    },
    "keyring": {
      tiers: [
        "Not every lock has to be unsaid. There is a KEY on the page.",
        "Walk to the KEY first. Once you have it, the LOCK will let you through.",
        "Walk to the key, then down through the lock, into the door. You do not need to speak.",
      ],
      solution: ["R", "R", "R", "R", "R", "R", "R", "R", "R", "R", "L", "D", "D", "R"],
    },
    "hinted": {
      tiers: [
        "The thing in the way is a word you also keep in the margin.",
        "HINT is a button, and HINT is a wall. Saying it unsays both.",
        "Say HINT, then walk through to the door. The hint button will burn with it.",
      ],
      solution: ["R", "R", "R", "R", "SAY:HINT", "R", "R", "R", "R", "R", "R", "R"],
    },
    "spoken": {
      tiers: [
        "SAID lives inside the name of the game.",
        "When you say SAID, the title will lose a piece of itself. That is the point.",
        "Say SAID, then walk to the door.",
      ],
      solution: ["R", "R", "R", "R", "SAY:SAID", "R", "R", "R", "R", "R", "R", "R"],
    },
    "doorway": {
      tiers: [
        "There is no door. There is a DOORWAY.",
        "Saying WAY leaves the letters DOOR behind. A leftover can still be a way out.",
        "Walk to the doorway, say WAY, and step into the door that remains.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:WAY"],
    },
    "remain": {
      tiers: [
        "WAY leaves a door. The other word leaves nothing.",
        "OR also lives inside DOORWAY. If you say it, no letters worth keeping will remain.",
        "Say WAY, not OR, then walk into the door.",
      ],
      solution: ["R", "R", "R", "R", "R", "SAY:WAY"],
    },
    "double": {
      tiers: [
        "A wall, then a doorway. Two breaths.",
        "ALL unsays the wall. WAY turns the doorway into a door.",
        "Say ALL, walk through, say WAY, and enter the door that remains.",
      ],
      solution: ["R", "R", "R", "R", "SAY:ALL", "R", "R", "R", "R", "R", "SAY:WAY"],
    },
    "title-room": {
      tiers: [
        "The title was a room. UNSAID is standing in the way.",
        "Say SAID, not ALL. What remains of UNSAID is a word you can walk through.",
        "Say SAID. The title burns. Walk through what is left, into the door.",
      ],
      solution: ["R", "R", "R", "R", "SAY:SAID", "R", "R", "R", "R", "R", "R", "R"],
    },
    "breath": {
      tiers: [
        "The doorway is inside a box of walls. You have two breaths.",
        "ALL will unsay the box. WAY will leave a door inside it. Leave OR unsaid.",
        "Open the box with ALL, walk in, say WAY, and enter the door.",
      ],
      solution: ["D", "D", "D", "R", "SAY:ALL", "R", "R", "R", "R", "SAY:WAY"],
    },
    "unfinished": {
      tiers: [
        "You do not have to speak.",
        "The way out is the word LATER.",
        "Walk right, into LATER. The rest is still unsaid.",
      ],
      solution: ["R", "R", "R", "R", "R", "R", "R", "R", "R", "R"],
    },
  };
  function getHints(id) { return HINTS[id] || null; }
  const api = { HINTS, getHints };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UnsaidHints = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
