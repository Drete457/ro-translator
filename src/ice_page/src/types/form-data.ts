interface PlayerFormData {
  userId: number | null;
  userName: string;
  power: number | null;
  faction: string;
  timeZone: string;
  t1InfantryCount: number;
  t2InfantryCount: number;
  t3InfantryCount: number;
  t4InfantryCount: number;
  t5InfantryCount: number;
  t1MagesCount: number;
  t2MagesCount: number;
  t3MagesCount: number;
  t4MagesCount: number;
  t5MagesCount: number;
  t1ArchersCount: number;
  t2ArchersCount: number;
  t3ArchersCount: number;
  t4ArchersCount: number;
  t5ArchersCount: number;
  t1CavalryCount: number;
  t2CavalryCount: number;
  t3CavalryCount: number;
  t4CavalryCount: number;
  t5CavalryCount: number;
  t1FlyingCount: number;
  t2FlyingCount: number;
  t3FlyingCount: number;
  t4FlyingCount: number;
  t5FlyingCount: number;
}

export type { PlayerFormData };