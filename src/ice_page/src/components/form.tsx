import { ChangeEvent, FC, FormEvent, useState, useEffect } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Stack,
  Paper
} from '@mui/material';
import { Faction, PlayerFormData } from '../types';
import { factionData, FormInitialData } from '../helpers';
import TierFields from './form-tier-fields';

interface FormProps {
  selectedFaction: Faction;
  setSelectedFaction: (faction: Faction) => void;
}

const Form: FC<FormProps> = ({
  selectedFaction,
  setSelectedFaction
}) => {
  const [formData, setFormData] = useState<PlayerFormData>({ ...FormInitialData, faction: selectedFaction ?? "" });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'userName' ? value : Number(value)
    }));
  };

  const saveToDatabase = async (data: PlayerFormData) => {
    console.log('Selected faction:', selectedFaction);
    console.log('Data ready to be sent to database:', data);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveToDatabase(formData);
    alert('Army data submitted successfully!');
  };

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const date = new Date();
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMinutesPart = Math.abs(offsetMinutes) % 60;
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetFormatted = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutesPart.toString().padStart(2, '0')}`;

    const timeZoneWithOffset = `${browserTimeZone} (UTC${offsetFormatted})`;

    setFormData(prev => ({
      ...prev,
      timeZone: timeZoneWithOffset
    }));
  }, []);

  return (
    <>
      <Typography variant="h6" sx={{ color: 'lightblue', mb: 2, textAlign: 'center' }}>
        Selected Faction: {selectedFaction}
      </Typography>
      <Button
        variant="outlined"
        onClick={() => setSelectedFaction(null)}
        sx={{
          mb: 3,
          display: 'block',
          mx: 'auto',
          color: 'white',
          borderColor: 'white',
          '&:hover': {
            borderColor: 'lightblue',
            color: 'lightblue'
          }
        }}
      >
        Change Faction
      </Button>

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
        <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="h6" sx={{ color: 'lightblue', mb: 2 }}>
            Player Information
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Stack spacing={1} alignItems="center">
                <TextField
                  required
                  fullWidth
                  id="userName"
                  label="User Name"
                  name="userName"
                  value={formData.userName}
                  onChange={handleChange}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover fieldset': { borderColor: 'lightblue' },
                    }
                  }}
                />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Stack spacing={1} alignItems="center">
                <TextField
                  required
                  fullWidth
                  id="userId"
                  label="User ID"
                  name="userId"
                  type="number"
                  value={formData.userId}
                  onChange={handleChange}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover fieldset': { borderColor: 'lightblue' },
                    }
                  }}
                />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Stack spacing={1} alignItems="center">
                <TextField
                  required
                  fullWidth
                  id="power"
                  label="Power"
                  name="power"
                  type="number"
                  value={formData.power}
                  onChange={handleChange}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover fieldset': { borderColor: 'lightblue' },
                    }
                  }}
                />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="h6" sx={{ color: 'lightblue', mb: 2 }}>
            Time Zone
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Stack spacing={1} alignItems="center">
                <TextField
                  required
                  fullWidth
                  id="timeZone"
                  label="Time Zone"
                  name="timeZone"
                  value={formData.timeZone}
                  onChange={handleChange}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover fieldset': { borderColor: 'lightblue' },
                    }
                  }}
                />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Typography variant="h6" sx={{ color: 'white', mb: 2, mt: 4 }}>
          Army Units
        </Typography>

        <TierFields selectedFaction={selectedFaction} unitType='infantry' imageUrl={`src/assets/units/${factionData[selectedFaction]['infantry'].name}.png`} fieldPrefix="InfantryCount" formData={formData} handleChange={handleChange} />

        <TierFields selectedFaction={selectedFaction} unitType='mages' imageUrl={`src/assets/units/${factionData[selectedFaction]['mages'].name}.png`} fieldPrefix="MagesCount" formData={formData} handleChange={handleChange} />

        <TierFields selectedFaction={selectedFaction} unitType='archers' imageUrl={`src/assets/units/${factionData[selectedFaction]['archers'].name}.png`} fieldPrefix="ArchersCount" formData={formData} handleChange={handleChange} />

        <TierFields selectedFaction={selectedFaction} unitType='cavalry' imageUrl={`src/assets/units/${factionData[selectedFaction]['cavalry'].name}.png`} fieldPrefix="CavalryCount" formData={formData} handleChange={handleChange} />

        <TierFields selectedFaction={selectedFaction} unitType='flying' imageUrl={`src/assets/units/${factionData[selectedFaction]['flying'].name}.png`} fieldPrefix="FlyingCount" formData={formData} handleChange={handleChange} />

        <Grid item xs={12}>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            sx={{
              mt: 4,
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#115293'
              }
            }}
          >
            Submit Army Data
          </Button>
        </Grid>
      </Box>
    </>
  );
}

export default Form;