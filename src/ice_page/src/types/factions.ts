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
      imgUrl: string;
    },
    [UnitType.Mages]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Archers]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Cavalry]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Flying]: {
      name: string;
      imgUrl: string;
    }
  };
  [Faction.LeagueOfOrder]: {
    [UnitType.Infantry]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Mages]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Archers]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Cavalry]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Flying]: {
      name: string;
      imgUrl: string;
    }
  };
  [Faction.Wilderburg]: {
    [UnitType.Infantry]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Mages]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Archers]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Cavalry]: {
      name: string;
      imgUrl: string;
    },
    [UnitType.Flying]: {
      name: string;
      imgUrl: string;
    }
  };
}

export { Faction, UnitType};
export type { FactionData };