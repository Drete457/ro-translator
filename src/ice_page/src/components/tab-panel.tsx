import { Box } from "@mui/material";
import { FC, ReactNode } from "react";

interface TabPanelProps {
  value: number;
  index: number;
  children?: ReactNode;
}

const TabPanel: FC<TabPanelProps> = (props) => {
  const { value, index, children, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default TabPanel;
