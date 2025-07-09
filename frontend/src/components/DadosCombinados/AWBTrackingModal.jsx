// frontend/src/components/DadosCombinados/AWBTrackingModal.jsx
import React from 'react';
import {
    Modal,
    Box,
    Typography,
    Card,
    CardHeader,
    CardContent,
    CircularProgress,
    IconButton,
    Grid,
    Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: { xs: '95%', sm: 600 },
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 0,
};

const InfoItem = ({ label, value, valueColor = 'text.secondary' }) => (
    <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.primary" display="block" sx={{ fontWeight: 'bold' }}>
            {label}
        </Typography>
        <Typography variant="body2" color={valueColor} sx={{ fontWeight: 'bold' }}>
            {value || 'Não informado'}
        </Typography>
    </Box>
);

const formatCurrency = (value) => {
    if (value === null || value === undefined) return null;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

// ==================================================================
// INÍCIO DA LÓGICA DE COR - NOVA FUNÇÃO
// ==================================================================
const getStatusColor = (status) => {
    // Se o status for nulo, indefinido ou vazio, usa a cor padrão.
    if (!status) {
        return 'text.secondary';
    }
    // Lista de status que devem ser verdes.
    const greenStatus = ['Liberado', 'Liberação autorizada'];

    // Verifica se o status atual (convertido para minúsculas para segurança)
    // está incluído na lista de status verdes.
    if (greenStatus.some(s => status.toLowerCase().includes(s.toLowerCase()))) {
        return 'success.main'; // Cor verde do tema MUI
    }

    // Se tiver qualquer outro status, retorna a cor vermelha.
    return 'error.main'; // Cor vermelha do tema MUI
};
// ==================================================================
// FIM DA LÓGICA DE COR
// ==================================================================

const AWBTrackingModal = ({ open, onClose, loading, trackingData, internalData, awb }) => {
    const trackingInfo = trackingData && trackingData[awb] ? trackingData[awb] : null;
    const title = `AWB: ${awb || ''} | TA: ${internalData?.numero_termo || ''}`;

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={modalStyle}>
                <Card>
                    <CardHeader
                        title={
                            <Typography variant="h6" component="h2">
                                Rastreamento
                            </Typography>
                        }
                        subheader={title}
                        titleTypographyProps={{ align: 'center' }}
                        subheaderTypographyProps={{ align: 'center' }}
                        action={
                            <IconButton aria-label="fechar" onClick={onClose}>
                                <CloseIcon />
                            </IconButton>
                        }
                        sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', py: 1.5, px: 2, '& .MuiCardHeader-subheader': { color: 'rgba(255, 255, 255, 0.8)' } }}
                    />
                    <CardContent sx={{ pt: 2, maxHeight: '80vh', overflowY: 'auto' }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 150 }}>
                                <CircularProgress />
                                <Typography sx={{ ml: 2 }}>Buscando informações...</Typography>
                            </Box>
                        ) : (
                            <Grid container spacing={2.5}>
                                {/* Coluna da Esquerda - Dados do Rastreamento */}
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" align="center" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 0.5, mb: 1.5 }}>
                                        Dados do Rastreamento
                                    </Typography>
                                    {trackingInfo && !trackingInfo.error ? (
                                        <>
                                            <InfoItem label="Último Status" value={trackingInfo.Ultimo_Status} />
                                            <InfoItem label="Tipo de Entrega" value={trackingInfo.Tipo_entrega} />
                                            <InfoItem label="Volumes" value={trackingInfo.Volumes} />
                                            <InfoItem label="Peso" value={`${trackingInfo.Peso} kg`} />
                                        </>
                                    ) : (
                                        <Typography color="error" variant="body2">
                                            {trackingInfo?.error || 'Não foi possível obter os dados de rastreamento.'}
                                        </Typography>
                                    )}
                                </Grid>

                                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' }, mr: "-1px" }} />

                                {/* Coluna da Direita - Dados Internos */}
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle1" align="center" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 0.5, mb: 1.5 }}>
                                        Dados Internos
                                    </Typography>
                                    {internalData ? (
                                        <>
                                            <InfoItem label="Base de Destino" value={internalData.fr_destino} />
                                            {/* ================================================================== */}
                                            {/* APLICAÇÃO DA LÓGICA DE COR */}
                                            {/* ================================================================== */}
                                            <InfoItem
                                                label="Situação do Termo"
                                                value={internalData.sefaz_status_situacao}
                                                valueColor={getStatusColor(internalData.sefaz_status_situacao)}
                                            />
                                            {/* ================================================================== */}
                                            <InfoItem label="Data da Situação" value={internalData.sefaz_data_termo} />
                                            <InfoItem label="Valor do Termo" value={formatCurrency(internalData.sefaz_valor_termo)} valueColor="error.main" />
                                        </>
                                    ) : (
                                        <Typography color="text.secondary" variant="body2">
                                            Dados internos não encontrados.
                                        </Typography>
                                    )}
                                </Grid>
                            </Grid>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Modal>
    );
};

export default AWBTrackingModal;