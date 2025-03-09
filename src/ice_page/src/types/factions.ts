enum Faction {
  Springwardens = 'Springwardens',
  LeagueOfOrder = 'League of Order',
  Wilderburg = 'Wilderburg'
}

enum UnitType {
  Infantry = 'infantry',
  Mages = 'mages',
  Archers = 'archers',
  Cavalry = 'cavalry',
  Flying = 'flying'
}

interface FactionData {
  [Faction.Springwardens]: {
    [UnitType.Infantry]: {
      name: string;
    },
    [UnitType.Mages]: {
      name: string;
    },
    [UnitType.Archers]: {
      name: string;
    },
    [UnitType.Cavalry]: {
      name: string;
    },
    [UnitType.Flying]: {
      name: string;
    }
  };
  [Faction.LeagueOfOrder]: {
    [UnitType.Infantry]: {
      name: string;
    },
    [UnitType.Mages]: {
      name: string;
    },
    [UnitType.Archers]: {
      name: string;
    },
    [UnitType.Cavalry]: {
      name: string;
    },
    [UnitType.Flying]: {
      name: string;
    }
  };
  [Faction.Wilderburg]: {
    [UnitType.Infantry]: {
      name: string;
    },
    [UnitType.Mages]: {
      name: string;
    },
    [UnitType.Archers]: {
      name: string;
    },
    [UnitType.Cavalry]: {
      name: string;
    },
    [UnitType.Flying]: {
      name: string;
    }
  };
}

export { Faction, UnitType};
export type { FactionData };