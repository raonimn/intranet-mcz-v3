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
    List,
    ListItem,
    ListItemText,
    Divider,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Estilo para a caixa do modal
const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 450,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 0, // Padding zerado para o CardHeader e CardContent controlarem
};

const AWBTrackingModal = ({ open, onClose, loading, data, awb }) => {
    // A API retorna um objeto onde a chave é o AWB. Ex: { "12345678": { ... } }
    const trackingInfo = data && data[String(awb).slice(-8)] ? data[String(awb).slice(-8)] : null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="tracking-modal-title"
            aria-describedby="tracking-modal-description"
        >
            <Box sx={modalStyle}>
                <Card>
                    <CardHeader
                        title={
                            <Typography variant="h6" component="h2" id="tracking-modal-title">
                                Rastreamento AWB: <strong>{String(awb).slice(-8)}</strong>
                            </Typography>
                        }
                        action={
                            <IconButton aria-label="fechar" onClick={onClose}>
                                <CloseIcon />
                            </IconButton>
                        }
                        sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', p: 2 }}
                    />
                    <CardContent sx={{ pt: 2 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 150 }}>
                                <CircularProgress />
                                <Typography sx={{ ml: 2 }}>Buscando informações...</Typography>
                            </Box>
                        ) : (
                            <Box id="tracking-modal-description">
                                {trackingInfo && !trackingInfo.error ? (
                                    <List dense>
                                        <ListItem>
                                            <ListItemText primary="Último Status" secondary={trackingInfo.Ultimo_Status || 'Não informado'} />
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem>
                                            <ListItemText primary="Tipo de Entrega" secondary={trackingInfo.Tipo_entrega || 'Não informado'} />
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem>
                                            <ListItemText primary="Volumes" secondary={trackingInfo.Volumes} />
                                        </ListItem>
                                        <Divider component="li" />
                                        <ListItem>
                                            <ListItemText primary="Peso" secondary={`${trackingInfo.Peso} kg`} />
                                        </ListItem>
                                    </List>
                                ) : (
                                    <Typography color="error" align="center" sx={{ mt: 3, mb: 2 }}>
                                        {trackingInfo?.error || 'Não foi possível obter os dados de rastreamento para este AWB.'}
                                    </Typography>
                                )}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Modal>
    );
};

export default AWBTrackingModal;