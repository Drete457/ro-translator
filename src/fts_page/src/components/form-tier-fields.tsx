import { ChangeEvent, FC } from "react";
import {
  Typography,
  TextField,
  Box,
  Grid,
  Stack,
  Paper
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Faction, PlayerFormData, UnitType } from "../types";
import { factionData } from "../helpers";

interface TierFieldsProps {
  selectedFaction: Faction;
  unitType: UnitType;
  fieldPrefix: string;
  formData: PlayerFormData;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  submitted: boolean; 
  errors: Record<string, string>;
}

const TierFields: FC<TierFieldsProps> = ({
  selectedFaction,
  unitType,
  fieldPrefix,
  formData,
  handleChange,
  submitted,
  errors
}) => {
  const theme = useTheme();
  const fieldSx = {
    '& .MuiInputBase-input': { color: theme.palette.text.primary },
    '& .MuiInputLabel-root': { color: theme.palette.primary.light },
    '& .MuiOutlinedInput-root': {
      backgroundColor: alpha(theme.palette.common.white, 0.02),
      '& fieldset': { borderColor: theme.palette.divider },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3, backgroundColor: alpha(theme.palette.common.white, 0.04), border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Box
          component="img"
          src={factionData[selectedFaction][unitType].imgUrl}
          alt={unitType}
          sx={{
            width: 96,
            height: 96,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        />
        <Typography variant="h6" sx={{ color: theme.palette.primary.light }}>
          {factionData[selectedFaction][unitType].name} Units
        </Typography>
      </Stack>

      {submitted && !!errors[`${unitType}Troops`] && (
        <Typography color={theme.palette.error.main} sx={{ mb: 1 }}>
          {errors[`${unitType}Troops`]}
        </Typography>
      )}
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5].map(tier => {
          const fieldName = `t${tier}${fieldPrefix}`;

          return (
            <Grid item xs={6} sm={4} md={2.4} key={fieldName}>
              <TextField
                fullWidth
                id={fieldName}
                label={`Tier ${tier}`}
                name={fieldName}
                type="number"
                value={formData[fieldName as keyof PlayerFormData]}
                onChange={handleChange}
                size="small"
                sx={fieldSx}
              />
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};


export default TierFields;