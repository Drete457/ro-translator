interface PlayerFormData {
  userId: number | undefined;
  userName: string;
  power: number | undefined;
  faction: string;
  unitsKilled: number | undefined;
  unitsLost: number | undefined;
  unitsHealed: number | undefined;
  timesAllianceHelped: number | undefined;
  timeZone: string;
  t1InfantryCount: number | undefined;
  t2InfantryCount: number | undefined;
  t3InfantryCount: number | undefined;
  t4InfantryCount: number | undefined;
  t5InfantryCount: number | undefined;
  t1MagesCount: number | undefined;
  t2MagesCount: number | undefined;
  t3MagesCount: number | undefined;
  t4MagesCount: number | undefined;
  t5MagesCount: number | undefined;
  t1ArchersCount: number | undefined;
  t2ArchersCount: number | undefined;
  t3ArchersCount: number | undefined;
  t4ArchersCount: number | undefined;
  t5ArchersCount: number | undefined;
  t1CavalryCount: number | undefined;
  t2CavalryCount: number | undefined;
  t3CavalryCount: number | undefined;
  t4CavalryCount: number | undefined;
  t5CavalryCount: number | undefined;
  t1FlyingCount: number | undefined;
  t2FlyingCount: number | undefined;
  t3FlyingCount: number | undefined;
  t4FlyingCount: number | undefined;
  t5FlyingCount: number | undefined;
}

export type { PlayerFormData };