import { FC } from "react";
import {
  Typography,
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActionArea
} from '@mui/material';
import { Faction } from "../types";
import { leagueOfOrder, springwardens, wilderburg } from "../assets";

interface SelectedFactionProps {
  handleFactionSelect: (faction: Faction) => void;
}

const SelectedFaction: FC<SelectedFactionProps> = ({
  handleFactionSelect
}) => (
  <Box sx={{ mt: 4 }}>
    <Typography variant="h5" gutterBottom align="center" sx={{ color: 'white', mb: 3 }}>
      Select your faction
    </Typography>
    <Grid container spacing={3} justifyContent="center">
      <Grid item xs={12} sm={6} md={4}>
        <Card
          sx={{
            backgroundColor: '#1e4976',
            color: 'white',
            transition: '0.3s',
            '&:hover': {
              transform: 'scale(1.03)',
              boxShadow: '0 8px 16px 0 rgba(0,0,0,0.3)'
            }
          }}
        >
          <CardActionArea onClick={() => handleFactionSelect(Faction.Springwardens)}>
            <CardMedia
              component="img"
              height="220"
              image={springwardens}
              alt="Springwardens"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div" align="center">
                Springwardens
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Card
          sx={{
            backgroundColor: '#1e4976',
            color: 'white',
            transition: '0.3s',
            '&:hover': {
              transform: 'scale(1.03)',
              boxShadow: '0 8px 16px 0 rgba(0,0,0,0.3)'
            }
          }}
        >
          <CardActionArea onClick={() => handleFactionSelect(Faction.LeagueOfOrder)}>
            <CardMedia
              component="img"
              height="220"
              image={leagueOfOrder}
              alt="League of Order"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div" align="center">
                League of Order
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Card
          sx={{
            backgroundColor: '#1e4976',
            color: 'white',
            transition: '0.3s',
            '&:hover': {
              transform: 'scale(1.03)',
              boxShadow: '0 8px 16px 0 rgba(0,0,0,0.3)'
            }
          }}
        >
          <CardActionArea onClick={() => handleFactionSelect(Faction.Wilderburg)}>
            <CardMedia
              component="img"
              height="220"
              image={wilderburg}
              alt="Wilderburg"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            />
            <CardContent>
              <Typography gutterBottom variant="h5" component="div" align="center">
                Wilderburg
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
    </Grid>
  </Box>
)

export default SelectedFaction;