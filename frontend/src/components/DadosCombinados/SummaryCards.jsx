// frontend/src/components/DadosCombinados/SummaryCards.jsx
import React from 'react';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Typography,
    List,
    ListItem,
    ListItemText,
    Chip,
    CircularProgress
} from '@mui/material';

const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num);

const SummaryCards = ({ loading, awbsByDestination, missingDates, lastFranchiseUpdate }) => {
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '150px', width: '100%' }}>
                <CircularProgress color="secondary" />
            </Box>
        );
    }

    const totalAwbsCalculated = Array.isArray(awbsByDestination)
        ? awbsByDestination.reduce((sum, item) => sum + item.total_awbs, 0)
        : 0;

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 3,
                mb: 4,
                mt: 2
            }}
        >
            {/* Card 1: AWBs Registrados */}
            <Card raised sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardHeader title="AWBs Registrados no Banco" titleTypographyProps={{ variant: 'h6', align: 'center' }} />
                <CardContent sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '300px' }}>
                    <List dense>
                        {awbsByDestination.map((item, idx) => (
                            <ListItem key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <ListItemText primary={item.destino || 'N/A'} />
                                <Chip label={formatNumber(item.total_awbs)} color="primary" size="small" />
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', p: 1, backgroundColor: 'action.hover' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        Total: {formatNumber(totalAwbsCalculated)} - {lastFranchiseUpdate}
                    </Typography>
                </CardActions>
            </Card>

            {/* Card 2: Datas Faltantes */}
            <Card raised sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardHeader title="Datas Faltantes (últimos 30 dias)" titleTypographyProps={{ variant: 'h6', align: 'center' }} />
                <CardContent sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: '300px' }}>
                    <List dense>
                        {Object.entries(missingDates || {}).map(([destino, dates], idx) => (
                            <ListItem key={idx}>
                                <ListItemText
                                    primary={<Typography component="span" fontWeight="bold">{destino || 'N/A'}:</Typography>}
                                    secondary={Array.isArray(dates) && dates.length > 0 ? dates.join(', ') : 'Todas as datas presentes.'}
                                />
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>

            {/* Card 3: Malha de Voos */}
            <Card raised sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <CardHeader title="Malha de Voos" titleTypographyProps={{ variant: 'h6', align: 'center' }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" align="center">
                        (Funcionalidade em desenvolvimento)
                    </Typography>
                    <CircularProgress color="info" size={30} sx={{ mt: 2 }} />
                </CardContent>
            </Card>
        </Box>
    );
};

export default SummaryCards;