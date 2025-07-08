// frontend/src/components/DadosCombinados/CombinedDataTable.jsx
import React, { useCallback } from 'react';
import useToast from '../../hooks/useToast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TableSortLabel,
    Tooltip,
    IconButton,
    Box,
    CircularProgress
} from '@mui/material';

const headCells = [
    { id: 'numero_termo', label: 'Termo' },
    { id: 'data_emissao', label: 'Dt Emissão' },
    { id: 'awb', label: 'AWB' },
    { id: 'fr_data_emissao', label: 'Emissão FR' },
    { id: 'fr_origem', label: 'Origem' },
    { id: 'fr_destino', label: 'Destino' },
    { id: 'fr_tomador', label: 'Tomador' },
    { id: 'fr_destinatario', label: 'Destinatário' },
    { id: 'numero_voo', label: 'Voo' },
    { id: 'chave_nfe', label: 'NFe', sortable: false },
    { id: 'chave_mdfe', label: 'MDFe', sortable: false },
    { id: 'sefaz_status_situacao', label: 'Status' },
];

const getRowClassName = (status) => {
    if (!status) return "";
    const statusLowerCase = status.toLowerCase();
    if (['pendente de pagamento', 'pendente (enviar e-mail)', 'pago com restrição'].includes(statusLowerCase)) return 'row-red';
    if (['liberação autorizada', 'liberado'].includes(statusLowerCase)) return 'row-green';
    if (statusLowerCase !== 'pendente') return 'row-yellow';
    return '';
};

const CombinedDataTable = ({ loading, items, order, orderBy, onRequestSort, onAwbClick }) => {
    const { showToast } = useToast();

    const copyToClipboard = useCallback(async (text, type) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copiado!', `${type} copiado para a área de transferência.`, 'info');
        } catch (err) {
            showToast('Erro', 'Falha ao copiar para a área de transferência.', 'danger');
            console.log(err);
        }
    }, [showToast]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                <CircularProgress color="primary" />
            </Box>
        );
    }

    return (
        <TableContainer component={Paper} elevation={3}>
            <Table stickyHeader aria-label="tabela de dados combinados">
                <TableHead>
                    <TableRow>
                        {headCells.map((headCell) => (
                            <TableCell key={headCell.id} sortDirection={orderBy === headCell.id ? order : false}>
                                {headCell.sortable === false ? (
                                    headCell.label
                                ) : (
                                    <TableSortLabel active={orderBy === headCell.id} direction={orderBy === headCell.id ? order : 'asc'} onClick={(e) => onRequestSort(e, headCell.id)}>
                                        {headCell.label}
                                    </TableSortLabel>
                                )}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.map((row, index) => (
                        <TableRow key={row.id} className={getRowClassName(row.sefaz_status_situacao)}>
                            <TableCell>{row.numero_termo || 'N/A'}</TableCell>
                            <TableCell>{row.data_emissao || 'N/A'}</TableCell>
                            <TableCell
                                onClick={() => row.awb && onAwbClick(row.awb)}
                                sx={{
                                    fontWeight: 'bold',
                                    cursor: row.awb ? 'pointer' : 'default',
                                    color: row.awb ? 'primary.main' : 'inherit',
                                    '&:hover': {
                                        textDecoration: row.awb ? 'underline' : 'none',
                                    },
                                }}
                            >
                                {row.awb || 'N/A'}
                            </TableCell>
                            <TableCell>{row.fr_data_emissao || 'N/A'}</TableCell>
                            <TableCell>{row.fr_origem || 'N/A'}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{row.fr_destino || 'N/A'}</TableCell>
                            <TableCell sx={{ textAlign: 'left' }}>{row.fr_tomador || 'N/A'}</TableCell>
                            <TableCell sx={{ textAlign: 'left' }}>{row.fr_destinatario || 'N/A'}</TableCell>
                            <TableCell>{row.numero_voo || 'N/A'}</TableCell>
                            <TableCell>
                                {row.chave_nfe ? (<Tooltip title={row.chave_nfe}><IconButton size="small" onClick={() => copyToClipboard(row.chave_nfe, 'Chave NFe')} color="primary"><FontAwesomeIcon icon={faCopy} size="xs" /></IconButton></Tooltip>) : ('N/A')}
                            </TableCell>
                            <TableCell>
                                {row.chave_mdfe ? (<Tooltip title={row.chave_mdfe}><IconButton size="small" onClick={() => copyToClipboard(row.chave_mdfe, 'Chave MDFe')} color="primary"><FontAwesomeIcon icon={faCopy} size="xs" /></IconButton></Tooltip>) : ('N/A')}
                            </TableCell>
                            <TableCell>{row.sefaz_status_situacao || 'Não Informado'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default CombinedDataTable;