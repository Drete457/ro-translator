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
import { Faction } from './types';
import Form from './components/form';
import { logo } from './assets';
import { MeritsForm, TabPanel } from './components';


const App = () => {
  const [selectedFaction, setSelectedFaction] = useState<Faction | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);

  const handleFactionSelect = (faction: Faction | null) => {
    setSelectedFaction(faction);
  };

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    event.preventDefault();
    setTabValue(newValue);
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

          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            textColor="inherit"
            indicatorColor="primary"
          >
            <Tab label="Army Data" />
            <Tab label="Merits" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {!selectedFaction ? (
              <SelectedFaction handleFactionSelect={handleFactionSelect} />
            ) : (
              <Form selectedFaction={selectedFaction} setSelectedFaction={setSelectedFaction} />
            )}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <MeritsForm setTabValue={setTabValue} />
          </TabPanel>
        </Paper>
      </Container>
    </Box>
  );
};

export default App;