import { useState } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
} from '@mui/material';
import SelectedFaction from './components/select-faction';
import { Faction } from './types';
import Form from './components/form';
import { logo } from './assets';

const App = () => {
  const [selectedFaction, setSelectedFaction] = useState<Faction>(null);
 
  const handleFactionSelect = (faction: Faction) => {
    setSelectedFaction(faction);
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
          
          {!selectedFaction ? (
            <SelectedFaction handleFactionSelect={handleFactionSelect}/>
          ) : (
           <Form selectedFaction={selectedFaction} setSelectedFaction={setSelectedFaction}/>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default App;