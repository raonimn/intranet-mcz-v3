const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const sqlite3 = require('sqlite3').verbose();
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const dbPath = path.join(__dirname, '../dados.db');
const uploadsDir = path.join(__dirname, '../uploads');

function conectarSQLite() {
  return new sqlite3.Database(dbPath);
}

function criarTabelas(db) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS dados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_emissao TEXT,
        chave_mdfe TEXT,
        numero_termo TEXT,
        chave_nfe TEXT UNIQUE,
        numero_cte TEXT,
        numero_nfe TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS termos_inseridos (
        numero_termo TEXT PRIMARY KEY
      )
    `);
  });
}

function limparTabelaTermosInseridos(db) {
  db.run("DELETE FROM termos_inseridos");
}

function inserirNumeroTermo(db, numeroTermo) {
  db.run("INSERT INTO termos_inseridos (numero_termo) VALUES (?)", [numeroTermo], err => {
    if (err) console.error('Erro ao inserir número de termo:', err.message);
  });
}

function inserirDados(db, dados) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO dados (data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  dados.forEach(dado => {
    if (dado.length === 6) {
      stmt.run(dado, err => {
        if (err) console.error('Erro ao inserir dados:', err.message);
      });
    }
  });

  stmt.finalize();
}

function extractDataOrNone(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1] : null;
}

function extractDataFromText(text) {
  const matchDemo = text.match(/\bDEMO VERSION\b/);
  const matchPosto = text.match(/\bPosto Fiscal: CENTRAL DAS TRANSPORTADORAS\b/);
  const matchRelatorio = text.match(/\bRelatório de Termos de Averiguação dos MDF-es\b/);

  let tipoPdf = 4;
  if (matchDemo) tipoPdf = matchPosto ? 3 : 2;
  else if (matchRelatorio) tipoPdf = 1;

  const dataEmissao = extractDataOrNone(text, /Data de Emissão\s*\n\s*(\d{2}\/\d{2}\/\d{4})/) || extractDataOrNone(text, /Data:(\d{2}\/\d{2}\/\d{4})/);
  const chaveMdfe = extractDataOrNone(text, /Chave do MDF-e\s*\n(?:\s+.+\n){2}\s+(\d{44})/) || extractDataOrNone(text, /Chave do MDF-e\s*\n(\d{44})/);

  let matches = [];
  if (tipoPdf === 1)
    matches = [...text.matchAll(/(?:(\d+) - )?(?:Pendente|Pago)?\n(\d{44})\n(\d+)\n(\d+)/g)];
  else if (tipoPdf === 2)
    matches = [...text.matchAll(/(?:Chave da NF-e)?\n(\d+)\n(\d{44})\n(\d+)\n(\d+)/g)];
  else if (tipoPdf === 3)
    matches = [...text.matchAll(/Nº do CT-e\s*(\d{44})\s*([\d.]+)\s*([\d.]+)\s*([\d.]+)/g)];

  let numeroAnterior = '';
  const dadosExtraidos = [];

  for (const match of matches) {
    const [_, pos1, pos2, pos3, pos4] = match;
    const n1 = pos1 || numeroAnterior;
    numeroAnterior = n1;

    let row;
    if (tipoPdf === 1)
      row = [dataEmissao, chaveMdfe, n1, pos2, pos4, pos3];
    else if (tipoPdf === 2)
      row = [dataEmissao, chaveMdfe, pos4, pos2, n1, pos3];
    else if (tipoPdf === 3)
      row = [dataEmissao, chaveMdfe, pos2.replace(/\./g, ""), pos1.replace(/\./g, ""), pos4.replace(/\./g, ""), pos3.replace(/\./g, "")];

    dadosExtraidos.push(row);
    console.log(row)
  }

  return dadosExtraidos;
}

function salvarCsv(dados, outputPath) {
  const writer = createCsvWriter({
    path: outputPath,
    header: [
      { id: 'data_emissao', title: 'Data de emissão' },
      { id: 'chave_mdfe', title: 'Chave MDF-e' },
      { id: 'numero_termo', title: 'Nº Termo Averiguação' },
      { id: 'chave_nfe', title: 'Chave da NF-e' },
      { id: 'numero_cte', title: 'Nº do CT-e' },
      { id: 'numero_nfe', title: 'Nº da NFe' },
    ]
  });

  const registros = dados.map(d => ({
    data_emissao: d[0], chave_mdfe: d[1], numero_termo: d[2],
    chave_nfe: d[3], numero_cte: d[4], numero_nfe: d[5],
  }));

  return writer.writeRecords(registros);
}

async function processarPDF(pdfFileName) {
  const pdfPath = path.join(uploadsDir, pdfFileName);
  if (!fs.existsSync(pdfPath)) {
    console.error(`Arquivo não encontrado: ${pdfFileName}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(buffer);
  const texto = pdfData.text;

  const dados = extractDataFromText(texto);
  const db = conectarSQLite();

  criarTabelas(db);
  limparTabelaTermosInseridos(db);
  inserirDados(db, dados);
  dados.forEach(d => d[2] && inserirNumeroTermo(db, d[2]));

  await salvarCsv(dados, path.join(__dirname, '../dados.csv'));

  db.close();
  console.log('Processamento concluído com sucesso!');
}

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.log("Uso: node src/extract.js <nome-do-arquivo.pdf>");
  process.exit(1);
}

processarPDF(args[0]).catch(err => {
  console.error('Erro durante o processamento:', err);
});
