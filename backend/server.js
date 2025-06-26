// backend/server.js

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

// Importa todas as funções do banco de dados (agora centralizadas)
const {
    createFranchiseReportTable,
    createSefazReportTable,
    createTermosInseridosTable,
    insertOrUpdateFranchiseReport, // Precisa ser importado para a rota /upload-report
    insertSefazReportData,        // Pode ser usado para dados de teste se reativados
    createConnection // Para a consulta combinada
} = require('./database');

// Importa o processador de PDF
const { processPdfAndSaveData } = require('./services/pdfProcessor');

const app = express();
const port = process.env.PORT || 8080;
const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Caminho para o arquivo do banco de dados SQLite
const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './dados.db');

// --- CRIAÇÃO DE TABELAS NA INICIALIZAÇÃO DO SERVIDOR ---
const initializeDatabase = async () => {
    try {
        if (LOG_DEBUG) console.log('[SERVER-INIT] Inicializando banco de dados...');
        await createFranchiseReportTable();
        await createSefazReportTable();
        await createTermosInseridosTable(); // Manter, pois ainda pode ser usada por outras lógicas
        if (LOG_DEBUG) console.log('[SERVER-INIT] Banco de dados inicializado com sucesso.');

        // --- REMOÇÃO DOS DADOS DE TESTE ---
        // if (LOG_DEBUG) console.log('[SERVER-INIT] Tentando inserir dados de teste...');
        // try {
        //     await insertSefazReportData(
        //         [['25/06/2025', 'CHAVEDEMDFE123456789012345678901234567890123456', 'TESTETERMO1', 'CHAVENFE123456789012345678901234567890123456', 'CTETEST1', 'NFE1']],
        //         'VOOTESTE',
        //         '25/06/2025'
        //     );
        //     if (LOG_DEBUG) console.log('[SERVER-INIT] Dado de teste (sefaz_report) inserido com sucesso.');
        // } catch (e) {
        //     console.error('[SERVER-INIT] ERRO ao inserir dado de teste (sefaz_report):', e.message);
        // }
        // try {
        //     await insertOrUpdateFranchiseReport([
        //         ['AWBTESTE1', 'CHAVECTE1234567890123456789012345678901234567', 'ORIGEMTESTE', 'DESTINOTESTE', 'DESTINATARIOTESTE', 'TOMADORTESTE', 'NOTASTESTE']
        //     ]);
        //     if (LOG_DEBUG) console.log('[SERVER-INIT] Dado de teste (franchise_report) inserido com sucesso.');
        // } catch (e) {
        //     console.error('[SERVER-INIT] ERRO ao inserir dado de teste (franchise_report):', e.message);
        // }
        // --- FIM DA REMOÇÃO ---

    } catch (error) {
        console.error('[SERVER-INIT] Falha crítica ao inicializar o banco de dados:', error.message);
        process.exit(1);
    }
};

initializeDatabase().then(() => {
    app.use(express.static('public'));
    app.use('/files', express.static(path.join(__dirname, 'public', 'files')));

    app.get('/', (req, res) => res.send('Frontend React será servido aqui!'));
    app.get('/impreport', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importarreport.html')));
    app.get('/imptermo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importatermo.html')));
    app.get('/natura', (req, res) => res.sendFile(path.join(__dirname, 'public', 'natura.html')));

    // --- Rotas de API ---

    // API para upload de arquivos PDF e processamento
    app.post('/api/upload-pdf', upload.single('pdf_file'), async (req, res) => {
        const file = req.file;
        const numeroVoo = req.body.numeroVoo;
        const dataRegistro = req.body.dataRegistro;

        if (!file) return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado.' });
        if (!numeroVoo || !numeroVoo.trim()) return res.status(400).json({ success: false, message: 'Por favor, insira o número do voo.' });
        if (!dataRegistro || !dataRegistro.trim()) return res.status(400).json({ success: false, message: 'Por favor, insira a data de registro.' });

        if (LOG_DEBUG) {
            console.log(`[DEBUG-SERVER] PDF recebido: ${file.originalname}, Número do Voo: ${numeroVoo}, Data de Registro: ${dataRegistro}`);
        }

        try {
            const success = await processPdfAndSaveData(file.buffer, numeroVoo, dataRegistro);
            // Contar os termos inseridos. Como clearTermosInseridosTable é chamado antes de cada PDF,
            // podemos contar os termos recém-inseridos na tabela termos_inseridos
            const conn = createConnection();
            const count = await new Promise((resolve, reject) => {
                conn.get('SELECT COUNT(*) AS total FROM termos_inseridos', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.total);
                });
            }).finally(() => conn.close());

            if (success) {
                res.status(200).json({ success: true, message: `PDF processado e ${count} termos salvos com sucesso!`, recordsProcessed: count });
            } else {
                res.status(500).json({ success: false, message: 'Erro ao processar o PDF.' });
            }
        } catch (error) {
            console.error('[ERROR-SERVER] Erro na rota /api/upload-pdf:', error);
            res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
        }
    });

    // API para upload de arquivos XLSX
    app.post('/api/upload-report', upload.single('xlsx_file'), validateXlsx, async (req, res) => {
        const file = req.file;

        if (!file) {
            return res.status(400).send('Nenhum arquivo enviado.');
        }

        try {
            const buffer = file.buffer;
            const workbook = xlsx.read(buffer, { type: 'buffer' });

            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            // O header: 1 faz com que a primeira linha seja considerada o cabeçalho e os dados comecem da segunda linha (range:1)
            // se o cabeçalho não estiver mapeado corretamente, pode ser necessário ajustar o range
            const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 }); // range: 0 para incluir todas as linhas, se o cabeçalho for B,D,I,J,N,T,BC

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] JSON data from XLSX (first 5 rows):', jsonData.slice(0, 5));
            }

            // Colunas a serem exibidas (B, D, F, I, J, N, T, BC)
            // Indices (0-indexed): B=1, D=3, F=5, I=8, J=9, N=13, T=19, BC=54
            const columnsToExtract = [1, 3, 5, 8, 9, 13, 19, 54]; // Adicionado F (indice 5)
            const headerRow = jsonData[0]; // Assume que a primeira linha é o cabeçalho

            const processedData = jsonData.slice(1).map((row) => { // Pula o cabeçalho
                // Mapear pelos índices das colunas
                const mappedRow = columnsToExtract.map((colIndex) => row[colIndex] || '');
                return mappedRow;
            }).filter(row => row.some(cell => cell !== '')); // Filtra linhas completamente vazias

            if (LOG_DEBUG) {
                console.log('[DEBUG-SERVER] Selected data for DB insertion (first 5 processed rows):', processedData.slice(0, 5));
            }

            await insertOrUpdateFranchiseReport(processedData);

            // Contar os registros inseridos/atualizados
            const conn = createConnection();
            const count = await new Promise((resolve, reject) => {
                conn.get('SELECT COUNT(*) AS total FROM franchise_report', (err, row) => {
                    if (err) reject(err);
                    else resolve(row.total);
                });
            }).finally(() => conn.close());

            console.log(`Dados do franchise report inseridos com sucesso! Total de registros na tabela: ${count}`);
            res.status(200).json({
                success: true,
                message: `Dados importados com sucesso! ${count} registros na tabela.`,
                recordsProcessed: count
            });

        } catch (error) {
            console.error('[ERROR-SERVER] Erro ao processar arquivo XLSX:', error.message);
            res.status(500).json({
                success: false,
                message: 'Erro ao processar arquivo: ' + error.message
            });
        }
    });

    // API para consultar os dados combinados
    app.get('/api/combined-data-specific', async (req, res) => {
        const { numeroVoo, dataRegistro } = req.query; // Captura parâmetros de query
        const { createConnection } = require('./database');

        let conn;
        try {
            conn = createConnection();

            // Lógica para filtrar por data
            let whereClauses = [];
            let params = [];

            // Adiciona filtro por número do voo, se fornecido
            if (numeroVoo && numeroVoo.trim() !== '') {
                whereClauses.push('sefaz_report.numero_voo LIKE ?');
                params.push(`%${numeroVoo.trim()}%`);
            }

            // Adiciona filtro por data de registro, se fornecida. Assume formato DD/MM/YYYY
            if (dataRegistro && dataRegistro.trim() !== '') {
                whereClauses.push('sefaz_report.data_registro = ?');
                params.push(dataRegistro.trim());
            } else {
                // Padrão: Últimos 2 dias até hoje
                const today = new Date();
                const twoDaysAgo = new Date();
                twoDaysAgo.setDate(today.getDate() - 2);

                // Formata as datas para DD/MM/YYYY
                const formatDateToDDMMYYYY = (date) => {
                    const d = String(date.getDate()).padStart(2, '0');
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const y = date.getFullYear();
                    return `${d}/${m}/${y}`;
                };

                const todayFormatted = formatDateToDDMMYYYY(today);
                const twoDaysAgoFormatted = formatDateToDDMMYYYY(twoDaysAgo);

                whereClauses.push('CAST(SUBSTR(sefaz_report.data_registro, 7, 4) AS INTEGER) * 10000 + CAST(SUBSTR(sefaz_report.data_registro, 4, 2) AS INTEGER) * 100 + CAST(SUBSTR(sefaz_report.data_registro, 1, 2) AS INTEGER) BETWEEN ? AND ?');
                params.push(parseInt(twoDaysAgoFormatted.replace(/\//g, ''), 10)); // YYYYMMDD para comparação numérica
     