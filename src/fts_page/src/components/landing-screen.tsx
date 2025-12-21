import { FC, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';

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
  const [userId, setUserId] = useState<string>('');

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
        textAlign: 'center'
      }}
    >
      <Typography variant="h4" sx={{ color: 'lightblue', mb: 4 }}>
        Welcome to Fury of The Titans Alliance
      </Typography>
      
      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
        Please choose an option:
      </Typography>

      <Stack spacing={4} alignItems="center" sx={{ width: '100%', maxWidth: 400 }}>
        {/* Search existing player section */}
        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle1" sx={{ color: 'lightblue', mb: 2 }}>
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
              sx={{
                '& .MuiInputBase-input': { color: 'white' },
                '& .MuiInputLabel-root': { color: 'lightblue' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.23)' },
                  '&:hover fieldset': { borderColor: 'lightblue' },
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              disabled={loading || !userId.trim()}
              sx={{
                backgroundColor: '#1976d2',
                color: 'white',
                fontWeight: 'bold',
                minWidth: 120,
                '&:hover': {
                  backgroundColor: '#115293'
                },
                '&:disabled': {
                  backgroundColor: '#e2e8f0',
                  color: '#64748b',
                  fontWeight: 'bold'
                }
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'Search'}
            </Button>
          </Stack>
        </Box>

        {/* Divider */}
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          OR
        </Typography>

        {/* New player section */}
        <Box sx={{ width: '100%' }}>
          <Typography variant="subtitle1" sx={{ color: 'lightblue', mb: 2 }}>
            New Player
          </Typography>
          <Button
            variant="outlined"
            onClick={onNewPlayer}
            disabled={loading}
            sx={{
              color: 'lightblue',
              borderColor: 'lightblue',
              width: '200px',
              py: 1.5,
              '&:hover': {
                borderColor: '#9fd8ff',
                backgroundColor: 'rgba(159, 216, 255, 0.1)'
              },
              '&:disabled': {
                color: '#94a3b8',
                borderColor: '#cbd5e1'
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