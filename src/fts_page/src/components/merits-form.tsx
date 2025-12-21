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
import { alpha, useTheme } from '@mui/material/styles';
import { MeritFormData, Faction, PlayerFormData } from '../types';
import { MeritsInitialData } from '../helpers';
import { addDoc, collection } from 'firebase/firestore';

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
  const theme = useTheme();
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

  const baseFieldSx = (hasError = false) => ({
    '& .MuiInputBase-input': { color: theme.palette.text.primary },
    '& .MuiInputLabel-root': { color: theme.palette.primary.light },
    '& .MuiFormHelperText-root': { color: hasError ? theme.palette.error.main : theme.palette.text.secondary },
    '& .MuiOutlinedInput-root': {
      backgroundColor: alpha(theme.palette.common.white, 0.02),
      '& fieldset': { borderColor: hasError ? theme.palette.error.main : theme.palette.divider },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
    }
  });

  const panelSx = {
    p: 2,
    mb: 3,
    backgroundColor: alpha(theme.palette.common.white, 0.04),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 2
  } as const;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    value.replace('.', '');

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
      newErrors.userId = 'User ID is required';
      isValid = false;
    }

    if (!formData.merits) {
      newErrors.merits = 'Merits is required';
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

    const docRef = await addDoc(collection(db, 'playersMerits'), {
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
      <Typography variant="h6" sx={{ color: theme.palette.primary.light, mb: 2, textAlign: 'center', fontWeight: 700 }}>
        Merits Form - {selectedFaction}
      </Typography>

      {existingUserData && (
        <Box sx={{ mb: 2, p: 2, backgroundColor: alpha(theme.palette.success.main, 0.16), borderRadius: 2, border: `1px solid ${alpha(theme.palette.success.main, 0.35)}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.success.main, textAlign: 'center', fontWeight: 700 }}>
            ✓ User data found! User ID has been pre-filled from your existing data.
          </Typography>
        </Box>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3 }}>
        <Paper sx={panelSx}>
          <Typography variant="h6" sx={{ color: theme.palette.primary.light, mb: 2 }}>
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
                  sx={baseFieldSx(submitted && Boolean(errors.userId))}
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
                  sx={baseFieldSx(submitted && !!errors.merits)}
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
                  color: theme.palette.primary.light,
                  borderColor: theme.palette.primary.main,
                  '&:hover': {
                    borderColor: theme.palette.primary.light,
                    backgroundColor: alpha(theme.palette.primary.main, 0.08)
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
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: 'bold',
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                  boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
                },
                '&:disabled': {
                  backgroundColor: theme.palette.action.disabledBackground,
                  color: theme.palette.text.disabled,
                  fontWeight: 'bold'
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
};

export default MeritsForm;
