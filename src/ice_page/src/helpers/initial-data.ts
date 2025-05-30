import { MeritFormData, PlayerFormData } from "../types";

const FormInitialData: PlayerFormData = Object.freeze({
  userId: undefined,
  userName: '',
  power: undefined,
  faction: '',
  unitsKilled: undefined,
  unitsLost: undefined,
  unitsHealed: undefined,
  timesAllianceHelped: undefined,
  timeZone: '',
  t1InfantryCount: undefined,
  t2InfantryCount: undefined,
  t3InfantryCount: undefined,
  t4InfantryCount: undefined,
  t5InfantryCount: undefined,
  t1MagesCount: undefined,
  t2MagesCount: undefined,
  t3MagesCount: undefined,
  t4MagesCount: undefined,
  t5MagesCount: undefined,
  t1ArchersCount: undefined,
  t2ArchersCount: undefined,
  t3ArchersCount: undefined,
  t4ArchersCount: undefined,
  t5ArchersCount: undefined,
  t1CavalryCount: undefined,
  t2CavalryCount: undefined,
  t3CavalryCount: undefined,
  t4CavalryCount: undefined,
  t5CavalryCount: undefined,
  t1FlyingCount: undefined,
  t2FlyingCount: undefined,
  t3FlyingCount: undefined,
  t4FlyingCount: undefined,
  t5FlyingCount: undefined,
});

const MeritsInitialData: MeritFormData = Object.freeze({
  userId: undefined,
  merits: undefined,
});

export default FormInitialData;
export { MeritsInitialData };