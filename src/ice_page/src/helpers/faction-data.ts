import { Faction, FactionData, UnitType } from "../types";

const factionData: FactionData = Object.freeze({
  [Faction.Springwardens]: {
    [UnitType.Infantry]: {
      name: 'Ironbark Treants'
    },
    [UnitType.Mages]: {
      name: 'Longleaf Treants'
    },
    [UnitType.Archers]: {
      name: 'Archers'
    },
    [UnitType.Cavalry]: {
      name: 'Elk Riders'
    },
    [UnitType.Flying]: {
      name: 'Forest Eagles'
    }
  },
  [Faction.LeagueOfOrder]: {
    [UnitType.Infantry]: {
      name: 'Swordsmen'
    },
    [UnitType.Mages]: {
      name: 'Vestals'
    },
    [UnitType.Archers]: {
      name: 'Ballistas'
    },
    [UnitType.Cavalry]: {
      name: 'Knights'
    },
    [UnitType.Flying]: {
      name: 'Celestials'
    }
  },
  [Faction.Wilderburg]: {
    [UnitType.Infantry]: {
      name: 'Axemen'
    },
    [UnitType.Mages]: {
      name: 'Satyr Witches'
    },
    [UnitType.Archers]: {
      name: 'Spearmen'
    },
    [UnitType.Cavalry]: {
      name: 'Wolf Riders'
    },
    [UnitType.Flying]: {
      name: 'Wyvern Riders'
    }
  },
});

export default factionData;