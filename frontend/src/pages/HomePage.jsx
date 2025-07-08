// frontend/src/components/Home.jsx

import React from 'react';
import {
    Box,
    Typography,
} from '@mui/material';

function Home() {
    return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h3" component="h1" sx={{ mt: 4 }}>
                Bem-vindo à Intranet da MCZ Express
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                O Portal interno de ferramentas e informações.
            </Typography>
        </Box>
    );
}

export default Home;