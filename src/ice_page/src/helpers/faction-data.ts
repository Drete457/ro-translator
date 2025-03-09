import { FactionData } from "../types";

const factionData: FactionData = Object.freeze({
  "Springwardens": {
    infantry: {
      name: 'Ironbark Treants'
    },
    mages: {
      name: 'Longleaf Treants'
    },
    archers: {
      name: 'Archers'
    },
    cavalry: {
      name: 'Elk Riders'
    },
    flying: {
      name: 'Forest Eagles'
    }
  },
  "League of Order": {
    infantry: {
      name: 'Swordsmen'
    },
    mages: {
      name: 'Vestals'
    },
    archers: {
      name: 'Ballistas'
    },
    cavalry: {
      name: 'Knights'
    },
    flying: {
      name: 'Celestials'
    }
  },
  "Wilderburg": {
    infantry: {
      name: 'Axemen'
    },
    mages: {
      name: 'Satyr Witches'
    },
    archers: {
      name: 'Spearmen'
    },
    cavalry: {
      name: 'Wolf Riders'
    },
    flying: {
      name: 'Wyvern Riders'
    }
  },
});

export default factionData;