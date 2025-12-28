import { FC, useMemo } from 'react';
import { Paper, Typography, Grid, Stack, Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { PlayerScanData } from '../types';

interface ScanReadOnlyPanelProps {
  scanData: PlayerScanData | null;
}

const fields: Array<{ key: keyof PlayerScanData; label: string }> = [
  { key: 'currentPowerScan', label: 'Current Power (scan)' },
  { key: 'powerScan', label: 'Power (scan)' },
  { key: 'divisionScan', label: 'Division (scan)' },
  { key: 'allianceIdScan', label: 'Alliance ID (scan)' },
  { key: 'allianceTagScan', label: 'Alliance Tag (scan)' },
  { key: 'factionScan', label: 'Faction (scan)' },
  { key: 'buildingPowerScan', label: 'Building Power (scan)' },
  { key: 'heroPowerScan', label: 'Hero Power (scan)' },
  { key: 'legionPowerScan', label: 'Legion Power (scan)' },
  { key: 'techPowerScan', label: 'Tech Power (scan)' },
  { key: 't1KillsScan', label: 'T1 Kill Count (scan)' },
  { key: 't2KillsScan', label: 'T2 Kill Count (scan)' },
  { key: 't3KillsScan', label: 'T3 Kill Count (scan)' },
  { key: 't4KillsScan', label: 'T4 Kill Count (scan)' },
  { key: 't5KillsScan', label: 'T5 Kill Count (scan)' },
  { key: 'unitsKilledScan', label: 'Units Killed (scan)' },
  { key: 'unitsDeadScan', label: 'Units Dead (scan)' },
  { key: 'unitsHealedScan', label: 'Units Healed (scan)' },
  { key: 'victoriesScan', label: 'Victories (scan)' },
  { key: 'defeatsScan', label: 'Defeats (scan)' },
  { key: 'citySiegesScan', label: 'City Sieges (scan)' },
  { key: 'coutedScan', label: 'Couted (scan)' },
  { key: 'helpsGivenScan', label: 'Helps Given (scan)' },
  { key: 'goldScan', label: 'Gold (scan)' },
  { key: 'goldSpentScan', label: 'Gold Spent (scan)' },
  { key: 'woodScan', label: 'Wood (scan)' },
  { key: 'woodSpentScan', label: 'Wood Spent (scan)' },
  { key: 'oreScan', label: 'Ore (scan)' },
  { key: 'oreSpentScan', label: 'Ore Spent (scan)' },
  { key: 'manaScan', label: 'Mana (scan)' },
  { key: 'manaSpentScan', label: 'Mana Spent (scan)' },
  { key: 'gemsScan', label: 'Gems (scan)' },
  { key: 'gemsSpentScan', label: 'Gems Spent (scan)' },
  { key: 'resourcesGivenScan', label: 'Resources Given (scan)' },
  { key: 'resourcesGivenCountScan', label: 'Resources Given Count (scan)' },
  { key: 'cityLevelScan', label: 'City Level (scan)' },
  { key: 'meritsScan', label: 'Merits (scan)' },
];

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
};

const formatValue = (key: keyof PlayerScanData, value: unknown) => {
  if (key === 'timestampScan' && typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return formatNumber(value);
};

const ScanReadOnlyPanel: FC<ScanReadOnlyPanelProps> = ({ scanData }) => {
  const theme = useTheme();

  const visibleFields = useMemo(() => {
    if (!scanData) return [];
    return fields
      .map((field) => ({ ...field, value: scanData[field.key] }))
      .filter((field) => field.value !== undefined && field.value !== null && field.value !== '');
  }, [scanData]);

  if (!scanData || visibleFields.length === 0) return null;

  return (
    <Paper
      sx={{
        mt: 3,
        p: 3,
        backgroundColor: alpha(theme.palette.primary.main, 0.04),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
        borderRadius: 2
      }}
    >
      <Stack spacing={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="h6" sx={{ color: theme.palette.primary.light, fontWeight: 700 }}>
            Scan Data (read-only)
          </Typography>
          {scanData.timestampScan && (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Last scan: {formatValue('timestampScan', scanData.timestampScan)}
            </Typography>
          )}
        </Box>

        <Grid container spacing={2}>
          {visibleFields.map((field) => (
            <Grid item xs={12} sm={6} md={4} key={field.key as string}>
              <Stack spacing={0.5}>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  {field.label}
                </Typography>
                <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                  {formatValue(field.key, field.value)}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  );
};

export default ScanReadOnlyPanel;
