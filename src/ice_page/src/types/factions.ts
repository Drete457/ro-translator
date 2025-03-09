type Faction = 'Springwardens' | 'League of Order' | 'Wilderburg' | null;

interface FactionData {
  "Springwardens": {
    infantry: {
      name: string;
    },
    mages: {
      name: string;
    },
    archers: {
      name: string;
    },
    cavalry: {
      name: string;
    },
    flying: {
      name: string;
    }
  };
  "League of Order": {
    infantry: {
      name: string;
    },
    mages: {
      name: string;
    },
    archers: {
      name: string;
    },
    cavalry: {
      name: string;
    },
    flying: {
      name: string;
    }
  };
  "Wilderburg": {
    infantry: {
      name: string;
    },
    mages: {
      name: string;
    },
    archers: {
      name: string;
    },
    cavalry: {
      name: string;
    },
    flying: {
      name: string;
    }
  };
}

export type { Faction, FactionData };