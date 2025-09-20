import { SyntheticEvent, useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import SelectedFaction from './components/select-faction';
import { Faction, PlayerFormData } from './types';
import Form from './components/form';
import { logo } from './assets';
import { MeritsForm, TabPanel, LandingScreen } from './components';
import getFirebase from './api/firebase';
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

type EntryStep = 'landing' | 'faction-selection' | 'forms';

const App = () => {
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [entryStep, setEntryStep] = useState<EntryStep>('landing');
  const [existingUserData, setExistingUserData] = useState<PlayerFormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUserDataById = async (userId: string): Promise<PlayerFormData | null> => {
    try {
      const db = await getFirebase();
      const playersInfoCollection = collection(db, 'playersInfo');

      // Try searching with userId as number first
      let q = query(
        playersInfoCollection,
        where('userId', '==', Number(userId)),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      let querySnapshot = await getDocs(q);

      // If no results found with number, try with string
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

  const handleSearch = async (userId: string) => {
    setLoading(true);
    setError('');

    try {
      const userData = await fetchUserDataById(userId);

      if (userData) {
        setExistingUserData(userData);
        setSelectedFaction(userData.faction as Faction);
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
  };

  const handleFactionSelect = (faction: Faction | null) => {
    console.log('Selected faction:', faction);
    if (!faction) {
      console.log('No faction selected, returning to faction selection.');
      setEntryStep('faction-selection');
      return;
    }

    setSelectedFaction(faction);

    if (faction)
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
    setError('');
    setTabValue(0);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#0a1929',
      pt: 4, pb: 4
    }}>
      <Container maxWidth="lg">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            backgroundColor: '#132f4c',
            color: 'white'
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
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 1
              }}
            />
            <Typography variant="h4" component="h1" sx={{ color: 'white' }}>
              Ice Wolves Alliance Army Data
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
                  style: { backgroundColor: 'lightblue' }
                }}
                sx={{
                  '& .MuiTab-root': {
                    color: 'rgba(255,255,255,0.7)',
                    '&.Mui-selected': { color: 'lightblue' }
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
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default App;