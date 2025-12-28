import { SyntheticEvent, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SelectedFaction from './components/select-faction';
import { Faction, PlayerFormData, PlayerScanData } from './types';
import Form from './components/form';
import { logo } from './assets';
import { MeritsForm, TabPanel, LandingScreen } from './components';
import ScanReadOnlyPanel from './components/scan-readonly-panel';
import getFirebase from './api/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

type EntryStep = 'landing' | 'faction-selection' | 'forms';

const App = () => {
  const theme = useTheme();
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [entryStep, setEntryStep] = useState<EntryStep>('landing');
  const [existingUserData, setExistingUserData] = useState<PlayerFormData | null>(null);
  const [scanData, setScanData] = useState<PlayerScanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUserDataById = async (userId: string): Promise<PlayerFormData | null> => {
    try {
      const db = await getFirebase();
      const playersInfoCollection = collection(db, 'playersInfo');

      let q = query(
        playersInfoCollection,
        where('userId', '==', Number(userId)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      let querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        q = query(
          playersInfoCollection,
          where('userId', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(1)
        );

        querySnapshot = await getDocs(q);
      }

      if (querySnapshot.empty)
        return null;

      const doc = querySnapshot.docs[0];
      return doc.data() as PlayerFormData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  };

  const fetchScanDataById = async (userId: string): Promise<PlayerScanData | null> => {
    try {
      const db = await getFirebase();
      const scansCollection = collection(db, 'playersScans');

      let q = query(
        scansCollection,
        where('userId', '==', Number(userId)),
        orderBy('timestampScan', 'desc'),
        limit(1)
      );

      let snapshot = await getDocs(q);

      if (snapshot.empty) {
        q = query(
          scansCollection,
          where('userId', '==', userId),
          orderBy('timestampScan', 'desc'),
          limit(1)
        );

        snapshot = await getDocs(q);
      }

      if (snapshot.empty) return null;

      return snapshot.docs[0].data() as PlayerScanData;
    } catch (err) {
      console.error('Error fetching scan data:', err);
      return null;
    }
  };

  const handleSearch = async (userId: string) => {
    setLoading(true);
    setError('');

    try {
      const [userData, scan] = await Promise.all([
        fetchUserDataById(userId),
        fetchScanDataById(userId)
      ]);

      if (userData) {
        setExistingUserData(userData);
        setSelectedFaction(userData.faction as Faction);
        setScanData(scan || null);
        setEntryStep('forms');
      } else {
        setError('User not found. Please check your User ID or start as a new player.');
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError('Error fetching user data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPlayer = () => {
    setEntryStep('faction-selection');
    setExistingUserData(null);
    setScanData(null);
  };

  const handleFactionSelect = (faction: Faction | null) => {
    if (!faction) {
      setEntryStep('faction-selection');
      return;
    }

    setSelectedFaction(faction);
    setEntryStep('forms');
  };

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    event.preventDefault();
    setTabValue(newValue);
  };

  const handleBackToStart = () => {
    setEntryStep('landing');
    setSelectedFaction(null);
    setExistingUserData(null);
    setScanData(null);
    setError('');
    setTabValue(0);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        pt: 4,
        pb: 4,
        backgroundImage: `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.light, 0.06)}, transparent 35%), radial-gradient(circle at 80% 0%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 30%)`
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: `0 10px 40px ${alpha('#000', 0.35)}`
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
              justifyContent: 'center'
            }}
          >
            <Box
              component="img"
              src={logo}
              alt="Logo"
              sx={{
                width: 80,
                height: 80,
                mr: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.18),
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`
              }}
            />
            <Typography variant="h4" component="h1" sx={{ color: theme.palette.text.primary }}>
              Fury of The Titans Alliance Army Data
            </Typography>
          </Box>

          {entryStep === 'landing' && (
            <LandingScreen
              onSearch={handleSearch}
              onNewPlayer={handleNewPlayer}
              loading={loading}
              error={error}
            />
          )}

          {entryStep === 'faction-selection' && (
            <SelectedFaction handleFactionSelect={handleFactionSelect} />
          )}

          {entryStep === 'forms' && selectedFaction && (
            <>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                textColor="inherit"
                TabIndicatorProps={{
                  style: { backgroundColor: theme.palette.primary.main }
                }}
                sx={{
                  '& .MuiTab-root': {
                    color: theme.palette.text.secondary,
                    '&.Mui-selected': { color: theme.palette.primary.light }
                  },
                  mb: 2
                }}
              >
                <Tab label="Army Data" />
                <Tab label="Merits" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Form
                  selectedFaction={selectedFaction}
                  setSelectedFaction={handleFactionSelect}
                  existingUserData={existingUserData}
                  onBackToStart={handleBackToStart}
                />
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                <MeritsForm
                  selectedFaction={selectedFaction}
                  existingUserData={existingUserData}
                  onBackToStart={handleBackToStart}
                />
              </TabPanel>

              <ScanReadOnlyPanel scanData={scanData} />
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default App;
