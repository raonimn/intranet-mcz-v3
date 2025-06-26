// app.js (atualizado)

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose(); // Use .verbose() para logs detalhados

// Importa as funções do banco de dados para franchise_report
const {
    createFranchiseReportTable,
    insertOrUpdateFranchiseReport,
} = require('./database'); // Seu arquivo database.js existente

// Importa o novo processador de PDF em JavaScript
const { processPdfAndSaveData } = require('./services/pdfProcessor'); // Novo arquivo

const app = express();
const port = 8080;

// Configuração do multer para o upload de arquivos
const storage = multer.memoryStorage(); // Armazena o arquivo na memória para processamento
const upload = multer({ storage: storage });

// Cria a tabela franchise_report no banco de dados
createFranchiseReportTable();

// Middleware para servir arquivos estáticos (será removido quando o frontend for React)
// Por enquanto, mantenha para referência e teste do antigo frontend
app.use(express.static('public'));
app.use('/files', express.static(path.join(__dirname, 'public', 'files')));

// Rotas existentes (podem ser removidas ou adaptadas para o frontend React)
// Rota para a página inicial (será o frontend React)
app.get('/', (req, res) => {
    // Em um ambiente de produção React, você serviria o index.html da build do React
    res.send('Frontend React será servido aqui!');
});

// Outras rotas HTML antigas (podem ser removidas)
app.get('/impreport', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importarreport.html')));
app.get('/imptermo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'importatermo.html')));
app.get('/natura', (req, res) => res.sendFile(path.join(__dirname, 'public', 'natura.html')));

// --- NOVAS ROTAS DE API PARA O FRONTEND REACT ---

// API para upload de arquivos PDF e processamento (substitui a rota /upload antiga)
app.post('/api/upload-pdf', upload.single('pdf_file'), async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo PDF enviado.' });
    }

    try {
        const success = await processPdfAndSaveData(file.buffer);

        if (success) {
            res.status(200).json({ success: true, message: 'PDF processado e dados salvos com sucesso!' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao processar o PDF.' });
        }
    } catch (error) {
        console.error('Erro na rota /api/upload-pdf:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// API para upload de arquivos XLSX (mantém a lógica existente, mas agora é uma API)
app.post('/api/upload-report', upload.single('xlsx_file'), validateXlsx, async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    try {
        const buffer = file.buffer;
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 1 });

        // Acesse as colunas B, D, I, J, N, T, BC (considerando índices baseados em zero)
        const columnsToDisplay = [1, 3, 8, 9, 13, 19, 54];
        const selectedData = jsonData.map((row) =>
            columnsToDisplay.map((colIndex) => row[colIndex] || '')
        ).filter(row => row.some(cell => cell !== ''));

        await insertOrUpdateFranchiseReport(selectedData);

        console.log('Dados do franchise report inseridos com sucesso!');
        res.status(200).json({
            success: true,
            message: 'Dados importados com sucesso!',
            recordsProcessed: selectedData.length
        });

    } catch (error) {
        console.error('Erro ao processar arquivo XLSX:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar arquivo: ' + error.message
        });
    }
});

// API para consultar os dados combinados
app.get('/api/combined-data-specific', async (req, res) => {
    let conn;
    try {
        conn = new sqlite3.Database(dbPath);

        const termosInseridos = await new Promise((resolve, reject) => {
            conn.all('SELECT numero_termo FROM termos_inseridos', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.numero_termo));
            });
        });

        if (!termosInseridos.length) {
            return res.status(200).json([]); // Retorna array vazio se não houver termos
        }

        const termosString = termosInseridos.map(termo => `'${termo}'`).join(',');

        const query = `
            SELECT dados.numero_termo, franchise_report.awb, franchise_report.origem,
                   franchise_report.destino, franchise_report.tomador, franchise_report.destinatario
            FROM dados
            INNER JOIN franchise_report ON printf('%09d', dados.numero_cte) = substr(franchise_report.chave_cte, 26, 9)
            WHERE dados.numero_termo IN (${termosString})
            ORDER BY franchise_report.destino, franchise_report.tomador, dados.numero_termo, franchise_report.destinatario ASC;
        `;

        const result = await new Promise((resolve, reject) => {
            conn.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.status(200).json(result);
    } catch (error) {
        console.error(`Erro durante a consulta de dados combinados: ${error.message}`);
        res.status(500).json({ success: false, message: 'Erro durante a consulta.' });
    } finally {
        if (conn) {
            conn.close((err) => {
                if (err) console.error("Erro ao fechar a conexão de dados combinados:", err.message);
            });
        }
    }
});


// Função de middleware para validar o arquivo XLSX
function validateXlsx(req, res, next) {
    const file = req.file;
    if (!file || file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        return res.status(400).json({ success: false, message: 'Formato de arquivo inválido. Por favor, envie um arquivo XLSX.' });
    }
    next();
}

// Inicia o servidor
app.listen(port, () => {
    console.log(`Backend rodando em http://localhost:${port}`);
});