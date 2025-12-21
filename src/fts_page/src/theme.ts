import { createTheme } from '@mui/material/styles';

export const brandColors = {
  background: '#0c0a08',
  surface: '#16100d',
  overlay: 'rgba(182, 120, 56, 0.08)',
  border: '#2a1c13',
  primary: '#b67838',
  primaryDark: '#8f5d2c',
  primaryLight: '#d8b074',
  textPrimary: '#f2e9dc',
  textSecondary: '#c5bfb4',
  muted: '#a39b90',
  success: '#71c29a',
  warning: '#f0c674',
  error: '#e07a5f'
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: brandColors.primary,
      dark: brandColors.primaryDark,
      light: brandColors.primaryLight,
      contrastText: brandColors.background
    },
    secondary: {
      main: brandColors.primaryLight,
      contrastText: brandColors.background
    },
    error: {
      main: brandColors.error
    },
    success: {
      main: brandColors.success
    },
    warning: {
      main: brandColors.warning
    },
    background: {
      default: brandColors.background,
      paper: brandColors.surface
    },
    text: {
      primary: brandColors.textPrimary,
      secondary: brandColors.textSecondary
    },
    divider: brandColors.border
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
          fontWeight: 700
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    }
  }
});

export default theme;
