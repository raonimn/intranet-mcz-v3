// backend/database.js

// backend/database.js

const mysql = require('mysql2/promise');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-DB]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-DB]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-DB]', ...args); };

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(connection => {
    debugLog('Pool de conexões MySQL criado e testado com sucesso!');
    connection.release();
  })
  .catch(err => {
    debugError('Erro FATAL ao criar/testar pool de conexões MySQL. Verifique credenciais e servidor:', err.message);
  });


async function initializeDatabase() {
  debugLog('--- Início de initializeDatabase ---');
  let connection;
  try {
    connection = await pool.getConnection();
    debugLog('Conexão para verificação/criação de tabelas estabelecida!');

    await connection.execute(`
            CREATE TABLE IF NOT EXISTS sefaz_report (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data_emissao VARCHAR(10) NOT NULL,
                chave_mdfe VARCHAR(44) NOT NULL,
                numero_termo VARCHAR(255) NOT NULL,
                chave_nfe VARCHAR(44) NOT NULL UNIQUE,
                numero_cte VARCHAR(255),
                numero_nfe VARCHAR(255),
                numero_voo VARCHAR(255),
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    debugLog('Tabela sefaz_report verificada/criada.');

    await connection.execute(`
            CREATE TABLE IF NOT EXISTS franchise_report (
                awb VARCHAR(255) PRIMARY KEY,
                chave_cte VARCHAR(255),
                origem VARCHAR(255),
                destino VARCHAR(255),
                tomador TEXT,
                notas VARCHAR(255),
                data_emissao VARCHAR(10),
                destinatario TEXT,
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    debugLog('Tabela franchise_report verificada/criada.');

    // --- NOVA TABELA DE LOGS ---
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action VARCHAR(255) NOT NULL,
                user_ip VARCHAR(45),
                mac_address VARCHAR(17),
                user_agent TEXT,
                details TEXT,
                success BOOLEAN DEFAULT TRUE
            );
        `);
    debugLog('Tabela logs verificada/criada.');


    debugLog('Pool de conexões MySQL testado e tabelas verificadas com sucesso!');

  } catch (error) {
    debugError("Erro ao criar tabelas no banco de dados:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de initializeDatabase ---');
  }
}


// --- NOVA FUNÇÃO PARA VERIFICAR A EXISTÊNCIA DE TABELAS ---
async function checkTableExistence(tableName) {
    let connection;
    try {
        connection = await pool.getConnection();
        // CORREÇÃO AQUI: Construir a string SQL para SHOW TABLES LIKE
        const [rows] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`); // Use aspas simples e concatene
        return rows.length > 0;
    } catch (error) {
        debugError(`Erro ao verificar existência da tabela ${tableName}: ${error.message}`);
        return false;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// --- NOVA FUNÇÃO PARA ESPERAR ATÉ QUE AS TABELAS ESTEJAM PRONTAS ---
async function waitForDatabaseTables(tableNames, maxRetries = 10, retryInterval = 2000) { // 10 retries * 2 segundos = 20 segundos
  debugLog('--- Início de waitForDatabaseTables ---');
  for (let i = 0; i < maxRetries; i++) {
    let allTablesExist = true;
    for (const tableName of tableNames) {
      const exists = await checkTableExistence(tableName);
      if (!exists) {
        allTablesExist = false;
        break;
      }
    }

    if (allTablesExist) {
      debugLog('Todas as tabelas necessárias foram detectadas no banco de dados.');
      return true;
    } else {
      debugWarn(`Aguardando tabelas do banco de dados... Tentativa ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  debugError('Tempo esgotado! Nem todas as tabelas foram detectadas no banco de dados.');
  return false;
}

// --- NOVA FUNÇÃO PARA INSERIR LOGS ---
async function insertLog(logData) {
  debugLog('--- Início de insertLog ---');
  const { action, user_ip, mac_address, user_agent, details, success } = logData;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.execute(
      `
            INSERT INTO logs (action, user_ip, mac_address, user_agent, details, success)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
      [action, user_ip, mac_address, user_agent, details, success]
    );
    debugLog(`Log inserido: ${action} - ID: ${result.insertId}`);
  } catch (error) {
    debugError(`Erro ao inserir log: ${error.message} LogData: ${JSON.stringify(logData)}`);
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de insertLog ---');
  }
}

// Funções de inserção e consulta (mantidas como estão, mas agora 'pool' está definido)

async function insertSefazReportData(data, numeroVoo) {
  debugLog('--- Início de insertSefazReportData ---');
  debugLog('Dados a serem inseridos:', data.length);
  debugLog('Número do Voo para inserção:', numeroVoo);

  let insertedCount = 0;
  let duplicateCount = 0;
  let totalProcessed = 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const insertQuery = `
            INSERT INTO sefaz_report (data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe, numero_voo, data_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                data_emissao = VALUES(data_emissao),
                chave_mdfe = VALUES(chave_mdfe),
                numero_termo = VALUES(numero_termo),
                numero_cte = VALUES(numero_cte),
                numero_nfe = VALUES(numero_nfe),
                numero_voo = VALUES(numero_voo);
        `;

    for (const row of data) {
      totalProcessed++;
      const [data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe] = row;

      try {
        const [result] = await connection.execute(insertQuery, [data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe, numeroVoo]);

        if (result.affectedRows > 0) {
          if (result.insertId > 0) { // Se um novo ID foi gerado, é uma nova inserção
            insertedCount++;
            debugLog(`Novo registro inserido: Termo ${numero_termo}, Chave NFe ${chave_nfe}`);
          } else { // Se affectedRows > 0 e insertId é 0, é uma atualização
            duplicateCount++;
            debugLog(`Registro duplicado atualizado: Termo ${numero_termo}, Chave NFe ${chave_nfe}`);
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { // MySQL specific duplicate entry error code
          debugWarn(`Entrada duplicada para chave_nfe: ${chave_nfe}. (Erro: ${error.message})`);
          duplicateCount++;
        } else if (error.code === 'ER_DATA_TOO_LONG') {
          debugError(`Erro de dados muito longos para coluna: ${error.sqlMessage}. Dado: ${JSON.stringify(row)}`);
        }
        else {
          debugError(`Erro INESPERADO ao inserir dado em sefaz_report: ${error.message} Dado: ${JSON.stringify(row)}`);
          throw error; // Re-lança outros erros para parar a transação
        }
      }
    }
    await connection.commit();
    debugLog(`Total processado: ${totalProcessed}, Inseridos: ${insertedCount}, Duplicados/Atualizados: ${duplicateCount}`);
  } catch (error) {
    await connection.rollback();
    debugError("Erro geral durante o processo de inserção em sefaz_report:", error.message);
    throw error;
  } finally {
    connection.release();
    debugLog('--- Fim de insertSefazReportData ---');
  }
  return { insertedCount, duplicateCount, totalProcessed };
}


async function insertFranchiseReportData(data) {
  debugLog('--- Início de insertFranchiseReportData ---');
  debugLog('Dados a serem inseridos no franchise_report:', data.length);

  let insertedCount = 0;
  let duplicateCount = 0;
  let totalProcessed = 0;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const insertUpdateQuery = `
            INSERT INTO franchise_report (awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario, data_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                chave_cte = VALUES(chave_cte),
                data_emissao = VALUES(data_emissao),
                origem = VALUES(origem),
                destino = VALUES(destino),
                tomador = VALUES(tomador),
                notas = VALUES(notas),
                destinatario = VALUES(destinatario);
        `;

    for (const row of data) {
      totalProcessed++;
      // Mapeamento Planilha para Banco:
      // Banco: AWB (PK), chave_cte, data_emissao, origem, destino, tomador, notas, destinatario
      // Planilha: B, D, F, I, J, T, BC, N
      // Indices (0-indexed):
      // AWB: B (0)
      // chave_cte: D (1)
      // data_emissao: F (2)
      // origem: I (3)
      // destino: J (4)
      // tomador: T (5)
      // notas: BC (6)
      // destinatario: N (7)
      const [awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario] = row;

      if (!awb) { // AWB é a PK, deve ser obrigatório
        debugWarn(`Registro com AWB vazio ou inválido pulado no franchise_report: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const [result] = await connection.execute(insertUpdateQuery, [awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario]);

        if (result.affectedRows > 0) {
          if (result.insertId > 0) { // If a new ID was generated, it's a new insert
            insertedCount++;
            debugLog(`Novo registro inserido no franchise_report: AWB ${awb}`);
          } else { // If affectedRows > 0 and insertId is 0, it's an update
            duplicateCount++;
            debugLog(`Registro duplicado atualizado no franchise_report: AWB ${awb}`);
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') { // MySQL specific duplicate entry error code
          debugWarn(`Entrada duplicada para AWB: ${awb} em franchise_report. (Erro: ${error.message})`);
          duplicateCount++;
        } else {
          debugError(`Erro INESPERADO ao inserir dado em franchise_report: ${error.message} Dado: ${JSON.stringify(row)}`);
          throw error;
        }
      }
    }
    await connection.commit();
    debugLog(`Total processado franchise: ${totalProcessed}, Inseridos: ${insertedCount}, Duplicados/Atualizados: ${duplicateCount}`);
  } catch (error) {
    await connection.rollback();
    debugError("Erro geral durante o processo de inserção em franchise_report:", error.message);
    throw error;
  } finally {
    connection.release();
    debugLog('--- Fim de insertFranchiseReportData ---');
  }
  return { insertedCount, duplicateCount, totalProcessed };
}

// getSefazReportData com COALESCE para AWB no SELECT
async function getSefazReportData(filters = {}) {
  debugLog('--- Início de getSefazReportData ---');
  const {
    data_emissao,
    chave_mdfe,
    numero_termo,
    chave_nfe,
    numero_cte,
    numero_nfe,
    numero_voo,
    awb, // AWB será filtro no campo COALESCIDO
    startDate,
    endDate
  } = filters;

  let query = `
        SELECT
            sr.id,
            sr.data_emissao,
            sr.chave_mdfe,
            sr.numero_termo,
            sr.chave_nfe,
            sr.numero_cte,
            sr.numero_nfe,
            sr.numero_voo,
            sr.data_registro,
            -- AWB final, obtido via fallback
            COALESCE(
                (SELECT fr1.awb FROM franchise_report fr1 WHERE fr1.numero_voo = sr.numero_voo AND sr.numero_cte = fr1.awb LIMIT 1),
                (SELECT fr2.awb FROM franchise_report fr2 WHERE fr2.numero_voo = sr.numero_voo AND sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND fr2.notas IS NOT NULL AND fr2.notas != '' AND sr.numero_nfe = LTRIM(REPLACE(fr2.notas, '0', ' ')) LIMIT 1)
            ) AS awb,
            fr.chave_cte AS fr_chave_cte,
            fr.origem,
            fr.destino,
            fr.tomador,
            fr.notas AS fr_notas, -- Renomeado para evitar conflito com notas do sefaz_report (se houvesse)
            fr.data_emissao AS franchise_data_emissao,
            fr.destinatario
        FROM sefaz_report sr
        LEFT JOIN franchise_report fr
        -- O JOIN principal é apenas pelo número de voo para não limitar a busca inicial
        -- As condições de match para AWB estão agora na subquery COALESCE
        ON sr.numero_voo = fr.numero_voo
        WHERE 1=1
    `;
  const params = [];

  if (data_emissao) {
    query += ` AND STR_TO_DATE(sr.data_emissao, '%d/%m/%Y') = STR_TO_DATE(?, '%d/%m/%Y')`;
    params.push(data_emissao);
  }
  if (chave_mdfe) {
    query += ` AND sr.chave_mdfe LIKE ?`;
    params.push(`%${chave_mdfe}%`);
  }
  if (numero_termo) {
    query += ` AND sr.numero_termo LIKE ?`;
    params.push(`%${numero_termo}%`);
  }
  if (chave_nfe) {
    query += ` AND sr.chave_nfe LIKE ?`;
    params.push(`%${chave_nfe}%`);
  }
  if (numero_cte) {
    query += ` AND sr.numero_cte LIKE ?`;
    params.push(`%${numero_cte}%`);
  }
  if (numero_nfe) {
    query += ` AND sr.numero_nfe LIKE ?`;
    params.push(`%${numero_nfe}%`);
  }
  if (numero_voo) {
    query += ` AND sr.numero_voo LIKE ?`;
    params.push(`%${numero_voo}%`);
  }
  // AWB é um campo COALESCIDO. Filtrar por ele exige que o filtro seja aplicado *no resultado*.
  // Uma forma de fazer isso em MySQL é com uma subquery ou HAVING (mas HAVING é pior para performance).
  // Para simplificar e evitar CTEs complexas aqui, vou replicar a lógica do COALESCE no WHERE
  // para o filtro de AWB, ou podemos pedir ao frontend para filtrar o AWB após o fetch, localmente.
  // Ou, se a performance permitir, usar uma subquery para o AWB filtrável.
  // Dada a complexidade, a rota no server.js já tem essa lógica de filtro AWB no WHERE,
  // que se aplica ao campo 'awb' COALESCIDO.
  // Vamos manter essa função getSefazReportData mais genérica.

  if (startDate) {
    query += ` AND STR_TO_DATE(sr.data_emissao, '%d/%m/%Y') >= STR_TO_DATE(?, '%d/%m/%Y')`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND STR_TO_DATE(sr.data_emissao, '%d/%m/%Y') <= STR_TO_DATE(?, '%d/%m/%Y')`;
    params.push(endDate);
  }

  try {
    const [rows] = await pool.execute(query, params);
    debugLog(`Dados do sefaz_report recuperados: ${rows.length} linhas.`);
    return rows;
  } catch (error) {
    debugError("Erro ao buscar dados do sefaz_report:", error);
    throw error;
  } finally {
    debugLog('--- Fim de getSefazReportData ---');
  }
}

async function getFranchiseReportData(filters = {}) {
  debugLog('--- Início de getFranchiseReportData ---');
  const {
    awb,
    numero_voo,
    data_voo,
    origem,
    destino,
    notas,
    startDate,
    endDate
  } = filters;

  let query = `SELECT * FROM franchise_report WHERE 1=1`;
  const params = [];

  if (awb) {
    query += ` AND awb LIKE ?`;
    params.push(`%${awb}%`);
  }
  if (numero_voo) {
    query += ` AND numero_voo LIKE ?`;
    params.push(`%${numero_voo}%`);
  }
  if (data_voo) {
    query += ` AND data_emissao = STR_TO_DATE(?, '%d/%m/%Y')`; // assuming data_voo from input is DD/MM/YYYY
    params.push(data_voo);
  }
  if (origem) {
    query += ` AND origem LIKE ?`;
    params.push(`%${origem}%`);
  }
  if (destino) {
    query += ` AND destino LIKE ?`;
    params.push(`%${destino}%`);
  }
  if (notas) {
    query += ` AND notas LIKE ?`;
    params.push(`%${notas}%`);
  }
  if (startDate) {
    query += ` AND STR_TO_DATE(data_emissao, '%d/%m/%Y') >= STR_TO_DATE(?, '%d/%m/%Y')`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND STR_TO_DATE(data_emissao, '%d/%m/%Y') <= STR_TO_DATE(?, '%d/%m/%Y')`;
    params.push(endDate);
  }

  try {
    const [rows] = await pool.execute(query, params);
    debugLog(`Dados do franchise_report recuperados: ${rows.length} linhas.`);
    return rows;
  } catch (error) {
    debugError("Erro ao buscar dados do franchise_report:", error);
    throw error;
  } finally {
    debugLog('--- Fim de getFranchiseReportData ---');
  }
}

// Adicionar nova função para buscar a última data de registro do franchise_report
async function getLastFranchiseImportDate() {
  debugLog('--- Início de getLastFranchiseImportDate ---');
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT MAX(data_registro) AS last_date FROM franchise_report`
    );
    const lastDate = rows[0].last_date; // Será um objeto Date ou null
    debugLog('Última data de importação de franchise:', lastDate);
    return lastDate;
  } catch (error) {
    debugError(`Erro ao buscar última data de importação de franchise: ${error.message}`);
    return null;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de getLastFranchiseImportDate ---');
  }
}


module.exports = {
    initializeDatabase,
    pool,
    insertSefazReportData,
    insertFranchiseReportData,
    getSefazReportData,
    getFranchiseReportData,
    insertLog,
    getLastFranchiseImportDate,
    waitForDatabaseTables // --- EXPORTAR A NOVA FUNÇÃO ---
};