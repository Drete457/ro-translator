import { FC, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

interface LandingScreenProps {
  onSearch: (userId: string) => void;
  onNewPlayer: () => void;
  loading: boolean;
  error?: string;
}

const LandingScreen: FC<LandingScreenProps> = ({
  onSearch,
  onNewPlayer,
  loading,
  error
}) => {
  const theme = useTheme();
  const [userId, setUserId] = useState<string>('');

  const fieldStyles = {
    '& .MuiInputBase-input': { color: theme.palette.text.primary },
    '& .MuiInputLabel-root': { color: theme.palette.primary.light },
    '& .MuiOutlinedInput-root': {
      backgroundColor: alpha(theme.palette.common.white, 0.02),
      '& fieldset': { borderColor: theme.palette.divider },
      '&:hover fieldset': { borderColor: theme.palette.primary.main },
      '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main }
    }
  };

  const handleSearch = () => {
    if (userId.trim()) {
      onSearch(userId.trim());
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && userId.trim()) {
      handleSearch();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center',
        background: alpha(theme.palette.primary.main, 0.04),
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        p: 4
      }}
    >
      <Typography variant="h4" sx={{ color: theme.palette.text.primary, mb: 4, fontWeight: 800 }}>
        Welcome to Fury of The Titans Alliance
      </Typography>
      
      <Typography variant="h6" sx={{ color: theme.palette.text.secondary, mb: 4 }}>
        Please choose an option:
      </Typography>

      <Stack spacing={4} alignItems="center" sx={{ width: '100%', maxWidth: 400 }}>
        {/* Search existing player section */}
        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle1" sx={{ color: theme.palette.primary.light, mb: 2 }}>
            Existing Player
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              label="Enter your User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyPress={handleKeyPress}
              type="number"
              inputProps={{ min: 0 }}
              disabled={loading}
              sx={fieldStyles}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !userId.trim()}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontWeight: 'bold',
                minWidth: 120,
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
            >
              {loading ? <CircularProgress size={24} /> : 'Search'}
            </Button>
          </Stack>
        </Box>

        {/* Divider */}
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          OR
        </Typography>

        {/* New player section */}
        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle1" sx={{ color: theme.palette.primary.light, mb: 2 }}>
            New Player
          </Typography>
          <Button
            variant="outlined"
            onClick={onNewPlayer}
            disabled={loading}
            sx={{
              color: theme.palette.primary.light,
              borderColor: theme.palette.primary.main,
              width: '200px',
              py: 1.5,
              '&:hover': {
                borderColor: theme.palette.primary.light,
                backgroundColor: alpha(theme.palette.primary.main, 0.08)
              },
              '&:disabled': {
                color: theme.palette.text.disabled,
                borderColor: theme.palette.action.disabledBackground
              }
            }}
          >
            Start as New Player
          </Button>
        </Box>

        {/* Error message */}
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default LandingScreen;