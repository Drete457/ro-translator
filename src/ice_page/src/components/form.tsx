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
import { Faction, PlayerFormData, UnitType } from '../types';
import { cFL, FormInitialData } from '../helpers';
import TierFields from './form-tier-fields';
import { addDoc, collection } from "firebase/firestore";

interface FormProps {
  selectedFaction: Faction;
  setSelectedFaction: (faction: Faction | null) => void;
}

const Form: FC<FormProps> = ({
  selectedFaction,
  setSelectedFaction
}) => {
  const [formData, setFormData] = useState<PlayerFormData>({ ...FormInitialData, faction: selectedFaction ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setErrors({});
    setFormData(prev => ({
      ...prev,
      [name]: name === 'userName' ? value : Math.abs(Number(value))
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!formData.userId) {
      newErrors.userId = "User ID is required";
      isValid = false;
    }

    if (!formData.userName) {
      newErrors.userName = "User Name is required";
      isValid = false;
    }

    if (!formData.power) {
      newErrors.power = "Power is required";
      isValid = false;
    }

    const troopTypes = [cFL(UnitType.Infantry), cFL(UnitType.Mages), cFL(UnitType.Archers), cFL(UnitType.Cavalry), cFL(UnitType.Flying)];
    troopTypes.forEach(type => {
      const hasTroops = [1, 2, 3, 4, 5].some(tier => {
        const fieldName = `t${tier}${type}Count` as keyof PlayerFormData;

        if (formData[fieldName] !== undefined && Number(formData[fieldName]) > 0)
          return true;

        return false;
      });

      if (!hasTroops) {
        newErrors[`${type.toLowerCase()}Troops`] = `At least one ${type} troop count is required`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };


  const saveToDatabase = async (data: PlayerFormData) => {
    const db = await import('../api').then(m => m.getFirebase());

    const newData = Object.entries(data).reduce((acc: Record<string, string | number>, [key, value]) => {
      acc[key] = value === undefined ? 0 : value;
      return acc;
    }, {} as Record<string, string | number>);

    const docRef = await addDoc(collection(db, "playersInfo"), {
      ...newData,
      timestamp: new Date().toISOString()
    });

    if (docRef.id)
      return true;

    return false;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (validateForm()) {
      const success = await saveToDatabase(formData);

      if (success) {
        alert('Army data submitted successfully!');
        setSelectedFaction(null);
        return;
      }

      alert('An unexpected error occurred. Please try again.');
      setSubmitted(false);
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert('Please fill all required fields');
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
                  error={submitted && !!errors.userName}
                  helperText={submitted && errors.userName}
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
                  error={submitted && Boolean(errors.userId)}
                  helperText={submitted && errors.userId}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiFormHelperText-root': { color: '#ff6b6b' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: (submitted && errors.userId) ? '#ff6b6b' : 'rgba(255, 255, 255, 0.23)' },
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
                  error={submitted && !!errors.power}
                  helperText={submitted && errors.power}
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

        <TierFields selectedFaction={selectedFaction} unitType={UnitType.Infantry} fieldPrefix="InfantryCount" formData={formData} handleChange={handleChange} submitted={submitted} errors={errors} />

        <TierFields selectedFaction={selectedFaction} unitType={UnitType.Mages} fieldPrefix="MagesCount" formData={formData} handleChange={handleChange} submitted={submitted} errors={errors} />

        <TierFields selectedFaction={selectedFaction} unitType={UnitType.Archers} fieldPrefix="ArchersCount" formData={formData} handleChange={handleChange} submitted={submitted} errors={errors} />

        <TierFields selectedFaction={selectedFaction} unitType={UnitType.Cavalry} fieldPrefix="CavalryCount" formData={formData} handleChange={handleChange} submitted={submitted} errors={errors} />

        <TierFields selectedFaction={selectedFaction} unitType={UnitType.Flying} fieldPrefix="FlyingCount" formData={formData} handleChange={handleChange} submitted={submitted} errors={errors} />

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
            disabled={submitted}
          >
            Submit Army Data
          </Button>
        </Grid>
      </Box>
    </>
  );
}

export default Form;