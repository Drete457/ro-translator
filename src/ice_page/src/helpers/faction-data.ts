import { Archers, Axemen, Ballistas, Celestials, Elk_Riders, Forest_Eagles, Ironbark_Treants, Knights, Longleaf_Treants, Satyr_Witches, Spearmen, Swordsmen, Vestals, Wolf_Riders, Wyvern_Riders } from "../assets/units";
import { Faction, FactionData, UnitType } from "../types";

const factionData: FactionData = Object.freeze({
  [Faction.Springwardens]: {
    [UnitType.Infantry]: {
      name: 'Ironbark Treants',
      imgUrl: Ironbark_Treants
    },
    [UnitType.Mages]: {
      name: 'Longleaf Treants',
imgUrl: Longleaf_Treants
    },
    [UnitType.Archers]: {
      name: 'Archers',
      imgUrl: Archers
    },
    [UnitType.Cavalry]: {
      name: 'Elk Riders',
      imgUrl: Elk_Riders
    },
    [UnitType.Flying]: {
      name: 'Forest Eagles',
      imgUrl: Forest_Eagles
    }
  },
  [Faction.LeagueOfOrder]: {
    [UnitType.Infantry]: {
      name: 'Swordsmen',
      imgUrl: Swordsmen
    },
    [UnitType.Mages]: {
      name: 'Vestals',
      imgUrl: Vestals
    },
    [UnitType.Archers]: {
      name: 'Ballistas',
      imgUrl: Ballistas
    },
    [UnitType.Cavalry]: {
      name: 'Knights',
      imgUrl: Knights
    },
    [UnitType.Flying]: {
      name: 'Celestials',
      imgUrl: Celestials
    }
  },
  [Faction.Wilderburg]: {
    [UnitType.Infantry]: {
      name: 'Axemen',
      imgUrl: Axemen
    },
    [UnitType.Mages]: {
      name: 'Satyr Witches',
      imgUrl: Satyr_Witches
    },
    [UnitType.Archers]: {
      name: 'Spearmen',
      imgUrl: Spearmen
    },
    [UnitType.Cavalry]: {
      name: 'Wolf Riders',
      imgUrl: Wolf_Riders
    },
    [UnitType.Flying]: {
      name: 'Wyvern Riders',
      imgUrl: Wyvern_Riders
    }
  },
});

export default factionData;