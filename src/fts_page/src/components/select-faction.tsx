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
import { alpha, useTheme } from '@mui/material/styles';
import { Faction } from "../types";
import { leagueOfOrder, springwardens, wilderburg } from "../assets";

interface SelectedFactionProps {
  handleFactionSelect: (faction: Faction) => void;
}

const SelectedFaction: FC<SelectedFactionProps> = ({
  handleFactionSelect
}) => {
  const theme = useTheme();
  const cardSx = {
    backgroundColor: alpha(theme.palette.common.white, 0.04),
    color: theme.palette.text.primary,
    transition: '0.3s',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 16px 34px rgba(0,0,0,0.45)',
      borderColor: alpha(theme.palette.primary.main, 0.6)
    }
  } as const;

  const mediaSx = {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderBottom: `1px solid ${theme.palette.divider}`
  } as const;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom align="center" sx={{ color: theme.palette.primary.light, mb: 3, fontWeight: 800 }}>
        Select your faction
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={cardSx}>
            <CardActionArea onClick={() => handleFactionSelect(Faction.Springwardens)}>
              <CardMedia
                component="img"
                height="220"
                image={springwardens}
                alt="Springwardens"
                sx={mediaSx}
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
          <Card sx={cardSx}>
            <CardActionArea onClick={() => handleFactionSelect(Faction.LeagueOfOrder)}>
              <CardMedia
                component="img"
                height="220"
                image={leagueOfOrder}
                alt="League of Order"
                sx={mediaSx}
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
          <Card sx={cardSx}>
            <CardActionArea onClick={() => handleFactionSelect(Faction.Wilderburg)}>
              <CardMedia
                component="img"
                height="220"
                image={wilderburg}
                alt="Wilderburg"
                sx={mediaSx}
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
  );
}

export default SelectedFaction;