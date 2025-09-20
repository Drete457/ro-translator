import { ChangeEvent, FC, FormEvent, useState } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Stack,
  Paper
} from '@mui/material';
import { MeritFormData, Faction, PlayerFormData } from '../types';
import { MeritsInitialData } from '../helpers';
import { addDoc, collection } from "firebase/firestore";

interface MeritsFormProps {
  selectedFaction: Faction;
  existingUserData?: PlayerFormData | null;
  onBackToStart?: () => void;
}

const MeritsForm: FC<MeritsFormProps> = ({
  selectedFaction,
  existingUserData,
  onBackToStart
}) => {
  const [formData, setFormData] = useState<MeritFormData>(() => {
    if (existingUserData) {
      return { 
        ...MeritsInitialData, 
        userId: existingUserData.userId || 0 
      };
    }
    return MeritsInitialData;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    value.replace(".", "");

    if (submitted) setSubmitted(false);
    setErrors({});
    if (/^[^\d-]$/.test(value))
      return;

    const cleanedValue = value.replace(/[^\d-]/g, '');
    if (cleanedValue === '')
      return;

    setFormData(prev => ({
      ...prev,
      [name]: Math.abs(Number(cleanedValue))
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!formData.userId) {
      newErrors.userId = "User ID is required";
      isValid = false;
    }

    if (!formData.merits) {
      newErrors.merits = "Merits is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const saveToDatabase = async (data: MeritFormData) => {
    const db = await import('../api').then(m => m.getFirebase());

    const newData = Object.entries(data).reduce((acc: Record<string, string | number>, [key, value]) => {
      acc[key] = value === undefined ? 0 : value;
      return acc;
    }, {} as Record<string, string | number>);

    const docRef = await addDoc(collection(db, "playersMerits"), {
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
        alert('Merits data submitted successfully');
        onBackToStart?.();
        return;
      }

      alert('An unexpected error occurred. Please try again.');
      setSubmitted(false);
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert('Please fill all required fields');
  };

  return (
    <>
      <Typography variant="h6" sx={{ color: 'lightblue', mb: 2, textAlign: 'center' }}>
        Merits Form - {selectedFaction}
      </Typography>

      {existingUserData && (
        <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: '#4caf50', textAlign: 'center' }}>
            ✓ User data found! User ID has been pre-filled from your existing data.
          </Typography>
        </Box>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
        <Paper sx={{ p: 2, mb: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
          <Typography variant="h6" sx={{ color: 'lightblue', mb: 2 }}>
            Merits Information
          </Typography>
          <Grid container spacing={3}>
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
                  id="merits"
                  label="Merits"
                  name="merits"
                  type="number"
                  value={formData.merits}
                  onChange={handleChange}
                  sx={{
                    '& .MuiInputBase-input': { color: 'white' },
                    '& .MuiInputLabel-root': { color: 'lightblue' },
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                      '&:hover fieldset': { borderColor: 'lightblue' },
                    }
                  }}
                  error={submitted && !!errors.merits}
                  helperText={submitted && errors.merits}
                />
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2} sx={{ mt: 4 }}>
          {onBackToStart && (
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={onBackToStart}
                sx={{
                  color: 'lightblue',
                  borderColor: 'lightblue',
                  '&:hover': {
                    borderColor: '#9fd8ff',
                    backgroundColor: 'rgba(159, 216, 255, 0.1)'
                  }
                }}
              >
                Back to Start
              </Button>
            </Grid>
          )}
          <Grid item xs={12} sm={onBackToStart ? 6 : 12}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              sx={{
                backgroundColor: '#1976d2',
                '&:hover': {
                  backgroundColor: '#115293'
                }
              }}
              disabled={submitted}
            >
              Submit Merits Data
            </Button>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}

export default MeritsForm;