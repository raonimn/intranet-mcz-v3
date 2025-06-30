// backend/database.js
const mysql = require('mysql2/promise'); // Usaremos a API de Promises para async/await
const util = require('util'); // Para promisificar o pool.query caso não use mysql2/promise diretamente

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-DB]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-DB]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-DB]', ...args); }; // Erros sempre logados

// Configuração do pool de conexões MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'intranet_password',
  database: process.env.DB_NAME || 'intranet_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Testar a conexão
pool.getConnection()
  .then(connection => {
    debugLog('Conectado ao banco de dados MySQL com sucesso!');
    connection.release(); // Libera a conexão
  })
  .catch(err => {
    debugError('Erro ao conectar ao banco de dados MySQL:', err.message);
    process.exit(1); // Encerra a aplicação se não conseguir conectar
  });

// Funções para criar tabelas (ajustadas para MySQL)
const createFranchiseReportTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS franchise_report (
      awb VARCHAR(255) PRIMARY KEY,
      chave_cte VARCHAR(255),
      origem VARCHAR(255),
      destino VARCHAR(255),
      tomador TEXT,
      notas TEXT,
      data_emissao VARCHAR(10),
      destinatario TEXT
    );
  `;
  try {
    await pool.execute(createTableQuery);
    debugLog('Tabela franchise_report criada com sucesso ou já existente.');
  } catch (err) {
    debugError('Erro ao criar a tabela franchise_report:', err.message);
    throw err;
  }
};

const createSefazReportTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS sefaz_report (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data_emissao VARCHAR(10),
      chave_mdfe VARCHAR(255),
      numero_termo VARCHAR(255),
      chave_nfe VARCHAR(255) UNIQUE,
      numero_cte VARCHAR(255),
      numero_nfe VARCHAR(255),
      numero_voo VARCHAR(255),
      data_registro VARCHAR(10)
    );
  `;
  try {
    await pool.execute(createTableQuery);
    debugLog('Tabela sefaz_report criada com sucesso ou já existente.');
    // Triggers são um pouco diferentes no MySQL. A restrição UNIQUE já garante o que queremos.
    // Não é necessário criar um trigger explícito para evitar duplicatas para UNIQUE.
  } catch (err) {
    debugError("Erro ao criar tabela sefaz_report:", err.message);
    throw err;
  }
};

const insertSefazReportData = async (dados, numeroVoo, dataRegistro) => {
  debugLog('--- Início de insertSefazReportData ---');
  debugLog('Dados a serem inseridos:', dados.length);
  debugLog('Número do Voo para inserção:', numeroVoo);
  debugLog('Data de Registro para inserção:', dataRegistro);

  if (dados.length === 0) {
    debugWarn('Nenhum dado de PDF para inserir.');
    return { insertedCount: 0, duplicateCount: 0, totalProcessed: 0 };
  }

  let insertedCount = 0;
  let duplicateCount = 0;
  let totalProcessed = 0;

  let connection;
  try {
    connection = await pool.getConnection(); // Obtém uma conexão do pool
    await connection.beginTransaction(); // Inicia uma transação

    const insertQuery = `
      INSERT INTO sefaz_report (data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe, numero_voo, data_registro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const dado of dados) {
      if (dado.length !== 6) {
        debugWarn(`Dado de PDF incompleto pulado: Esperava 6 elementos, mas encontrou ${dado.length}. Dado:`, dado);
        continue;
      }
      totalProcessed++;

      try {
        await connection.execute(insertQuery, [dado[0], dado[1], dado[2], dado[3], dado[4], dado[5], numeroVoo, dataRegistro]);
        insertedCount++;
        debugLog('Dado em sefaz_report inserido com sucesso: Chave NF-e:', dado[3]);
      } catch (runErr) {
        // Erro de duplicidade no MySQL (ER_DUP_ENTRY para UNIQUE constraint)
        if (runErr.code === 'ER_DUP_ENTRY' || runErr.sqlMessage.includes('Duplicate entry')) {
          debugWarn(`Entrada duplicada para chave_nfe: ${dado[3]} em sefaz_report. Ignorando inserção. (Erro: ${runErr.message})`);
          duplicateCount++;
        } else {
          debugError("Erro INESPERADO ao inserir dado em sefaz_report:", runErr.message, 'Dado:', dado);
          // Rejeita ou lança erro para interromper a transação se for um erro crítico
          await connection.rollback(); // Faz rollback em caso de erro
          throw runErr; // Relança o erro para o catch externo
        }
      }
    }

    await connection.commit(); // Confirma a transação
    debugLog(`Transação para sefaz_report commitada com sucesso. Inseridos: ${insertedCount}, Duplicados: ${duplicateCount}, Total Processado: ${totalProcessed}`);
    return { insertedCount, duplicateCount, totalProcessed };

  } catch (error) {
    debugError("Erro geral durante o processo de inserção em sefaz_report:", error.message);
    if (connection) {
      await connection.rollback(); // Garante rollback em caso de falha antes do commit
    }
    throw error; // Propaga o erro para quem chamou
  } finally {
    if (connection) {
      connection.release(); // Sempre libera a conexão
    }
    debugLog('--- Fim de insertSefazReportData ---');
  }
};


const insertOrUpdateFranchiseReport = async (dados) => {
  debugLog('--- Início de insertOrUpdateFranchiseReport ---');
  debugLog(`Recebidos ${dados.length} registros para processamento.`);

  if (dados.length === 0) {
    debugWarn('Nenhum dado para inserir/atualizar em franchise_report.');
    return;
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const insertUpdateQuery = `
      INSERT INTO franchise_report (awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chave_cte = VALUES(chave_cte),
        data_emissao = VALUES(data_emissao),
        origem = VALUES(origem),
        destino = VALUES(destino),
        tomador = VALUES(tomador),
        notas = VALUES(notas),
        destinatario = VALUES(destinatario);
    `;

    for (const dado of dados) {
      const awb = dado[0];
      const chave_cte = dado[1];
      const data_emissao = dado[2];
      const origem = dado[3];
      const destino = dado[4];
      const tomador = dado[5];
      const notas = dado[6];
      const destinatario = dado[7];

      if (!awb) { // AWB é a PK, deve ser obrigatório
        debugWarn(`Registro com AWB vazio ou inválido pulado: ${JSON.stringify(dado)}`);
        continue;
      }

      try {
        await connection.execute(insertUpdateQuery, [awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario]);
        debugLog(`Registro inserido/atualizado: AWB ${awb}`);
      } catch (runErr) {
        debugError('Erro ao inserir/atualizar dados na tabela franchise_report:', runErr.message, 'Dados:', dado);
        await connection.rollback();
        throw runErr;
      }
    }

    await connection.commit();
    debugLog(`${dados.length} registros processados para inserção/atualização na tabela franchise_report. Commit bem-sucedido.`);

  } catch (error) {
    debugError("Erro geral durante o processo de inserção/atualização em franchise_report:", error.message);
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de insertOrUpdateFranchiseReport ---');
  }
};

// Funções de consulta de dados (ajustadas para MySQL)
// As queries aqui serão executadas diretamente pelo server.js,
// usando o pool.execute() ou pool.query()
// Portanto, não precisamos de funções específicas de consulta aqui no database.js.
// O pool de conexões será exportado para ser usado diretamente pelo server.js

module.exports = {
  pool, // Exporta o pool de conexões para o server.js
  createFranchiseReportTable,
  createSefazReportTable,
  insertOrUpdateFranchiseReport,
  insertSefazReportData,
};