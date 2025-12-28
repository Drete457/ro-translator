interface PlayerScanData {
  userId: number | string;
  userName?: string;
  currentPowerScan?: number;
  powerScan?: number;
  divisionScan?: string;
  allianceIdScan?: string;
  allianceTagScan?: string;
  meritsScan?: number;
  unitsKilledScan?: number;
  unitsDeadScan?: number;
  unitsHealedScan?: number;
  t1KillsScan?: number;
  t2KillsScan?: number;
  t3KillsScan?: number;
  t4KillsScan?: number;
  t5KillsScan?: number;
  buildingPowerScan?: number;
  heroPowerScan?: number;
  legionPowerScan?: number;
  techPowerScan?: number;
  victoriesScan?: number;
  defeatsScan?: number;
  citySiegesScan?: number;
  scoutedScan?: number;
  coutedScan?: number; // legacy/alias
  helpsGivenScan?: number;
  goldScan?: number;
  goldSpentScan?: number;
  woodScan?: number;
  woodSpentScan?: number;
  oreScan?: number;
  oreSpentScan?: number;
  manaScan?: number;
  manaSpentScan?: number;
  gemsScan?: number;
  gemsSpentScan?: number;
  resourcesGivenScan?: number;
  resourcesGivenCountScan?: number;
  cityLevelScan?: number;
  factionScan?: string;
  timestampScan?: string;
}

export type { PlayerScanData };
