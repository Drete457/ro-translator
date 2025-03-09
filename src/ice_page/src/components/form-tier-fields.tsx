import { ChangeEvent, FC } from "react";
import {
  Typography,
  TextField,
  Box,
  Grid,
  Stack,
  Paper
} from '@mui/material';
import { Faction, FactionData, PlayerFormData } from "../types";
import { factionData } from "../helpers";

interface TierFieldsProps {
  selectedFaction: Faction;
  unitType: string;
  imageUrl: string;
  fieldPrefix: string;
  formData: PlayerFormData;
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

const TierFields: FC<TierFieldsProps> = ({
  selectedFaction,
  unitType,
  imageUrl,
  fieldPrefix,
  formData,
  handleChange
}) => (
  <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
      <Box
        component="img"
        src={imageUrl}
        alt={unitType}
        sx={{
          width: 96,
          height: 96,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 1
        }}
      />
      <Typography variant="h6" sx={{ color: 'lightblue' }}>
        {factionData[selectedFaction][unitType].name} Units
      </Typography>
    </Stack>

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
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'lightblue' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                  '&:hover fieldset': { borderColor: 'lightblue' },
                }
              }}
            />
          </Grid>
        );
      })}
    </Grid>
  </Paper>
);


export default TierFields;