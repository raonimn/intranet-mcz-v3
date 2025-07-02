// backend/database.js

const mysql = require('mysql2/promise');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-DB]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-DB]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-DB]', ...args); };

let initializedPool = null; // O pool será armazenado aqui, inicialmente null

// --- FUNÇÃO PARA OBTER A INSTÂNCIA DO POOL (SINGLETON) - MOVIDA PARA O TOPO ---
// ESTA FUNÇÃO PRECISA SER DEFINIDA ANTES DE QUALQUER OUTRA FUNÇÃO QUE A CHAMA.
async function getDbPoolInstance() {
  debugLog('getDbPoolInstance: Verificando estado do pool. initializedPool:', initializedPool ? 'DEFINED' : 'NULL');
  if (initializedPool) {
    debugLog('getDbPoolInstance: Retornando pool existente.');
    return initializedPool;
  }

  debugLog('getDbPoolInstance: Pool não inicializado. Criando novo Pool de conexões MySQL...');
  try {
    const tempPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    const connection = await tempPool.getConnection();
    debugLog('getDbPoolInstance: Novo Pool de conexões MySQL criado e testado com sucesso!');
    connection.release();

    initializedPool = tempPool;
    debugLog('getDbPoolInstance: Pool atribuído globalmente. Retornando novo pool.');
    return initializedPool;
  } catch (err) {
    debugError('getDbPoolInstance: Erro FATAL ao criar/testar Pool de conexões MySQL:', err.message);
    throw err;
  }
}


// --- TODAS AS OUTRAS FUNÇÕES DEVEM VIR DEPOIS DE getDbPoolInstance ---

async function initializeDatabase() {
  debugLog('initializeDatabase: Início da função.');
  let connection;
  try {
    const currentPool = await getDbPoolInstance();
    debugLog('initializeDatabase: Pool obtido com sucesso. Verificando/Criando tabelas...');
    connection = await currentPool.getConnection();
    debugLog('initializeDatabase: Conexão para verificação/criação de tabelas estabelecida!');

    // ALTERAÇÃO AQUI: Adicionar coluna 'awb' em sefaz_report
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
                awb VARCHAR(255), -- NOVA COLUNA AQUI
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    debugLog('initializeDatabase: Tabela sefaz_report verificada/criada (com coluna awb).');

    // Se a coluna 'awb' já existir, mas você adicionou isso depois,
    // o MySQL ignorará o `CREATE TABLE IF NOT EXISTS`.
    // Para adicionar a coluna a uma tabela existente (apenas uma vez):
    // Você pode executar manualmente no seu DB client:
    // ALTER TABLE sefaz_report ADD COLUMN awb VARCHAR(255);
    // Ou adicionar a lógica de alteração aqui, mas isso é mais complexo para um script de inicialização.
    // Para o nosso propósito de desenvolvimento, a criação acima já considera a coluna.

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

    await connection.execute(`
            CREATE TABLE IF NOT EXISTS logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action VARCHAR(255) NOT NULL,
                user_ip VARCHAR(45),
                mac_address VARCHAR(255),
                user_agent TEXT,
                details TEXT,
                success BOOLEAN DEFAULT TRUE
            );
        `);
    debugLog('initializeDatabase: Tabela logs verificada/criada.');

    await connection.execute(`
            CREATE TABLE IF NOT EXISTS sefaz_status_termos (
                numero_termo VARCHAR(255) PRIMARY KEY,
                data_status VARCHAR(10) NOT NULL,
                situacao VARCHAR(255),
                valor DECIMAL(10, 2),
                data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    debugLog('initializeDatabase: Tabela sefaz_status_termos verificada/criada.');

    debugLog('initializeDatabase: Pool de conexões MySQL testado e tabelas verificadas com sucesso!');

  } catch (error) {
    debugError("initializeDatabase: Erro ao criar tabelas no banco de dados:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('initializeDatabase: Fim da função.');
  }
}


async function checkTableExistence(tableName) {
  debugLog(`checkTableExistence: Verificando tabela ${tableName}.`);
  let connection;
  try {
    const currentPool = await getDbPoolInstance();
    connection = await currentPool.getConnection();
    const [rows] = await connection.execute(`SHOW TABLES LIKE '${tableName}'`);
    debugLog(`checkTableExistence: Tabela ${tableName} existe: ${rows.length > 0}`);
    return rows.length > 0;
  } catch (error) {
    debugError(`checkTableExistence: Erro ao verificar existência da tabela ${tableName}: ${error.message}`);
    return false;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function waitForDatabaseTables(tableNames, maxRetries = 10, retryInterval = 2000) {
  debugLog('waitForDatabaseTables: Início da função.');
  for (let i = 0; i < maxRetries; i++) {
    let allTablesExist = true;
    for (const tableName of tableNames) {
      const exists = await checkTableExistence(tableName); // checkTableExistence já usa getDbPoolInstance()
      if (!exists) {
        allTablesExist = false;
        break;
      }
    }

    if (allTablesExist) {
      debugLog('waitForDatabaseTables: Todas as tabelas necessárias foram detectadas no banco de dados.');
      return true;
    } else {
      debugWarn(`waitForDatabaseTables: Aguardando tabelas do banco de dados... Tentativa ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  debugError('waitForDatabaseTables: Tempo esgotado! Nem todas as tabelas foram detectadas no banco de dados.');
  return false;
}

async function insertSefazReportData(data, numeroVoo) {
  debugLog('insertSefazReportData: Início da função.');
  debugLog('insertSefazReportData: Dados a serem inseridos:', data.length);
  debugLog('insertSefazReportData: Número do Voo para inserção:', numeroVoo);

  let insertedCount = 0;
  let duplicateCount = 0;
  let totalProcessed = 0;
  const processedTermos = []; // Para armazenar numero_termo dos termos processados

  const currentPool = await getDbPoolInstance();
  const connection = await currentPool.getConnection();
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
          if (result.insertId > 0) {
            insertedCount++;
            debugLog(`insertSefazReportData: Novo registro inserido: Termo ${numero_termo}, Chave NFe ${chave_nfe}`);
            processedTermos.push(numero_termo);
          } else {
            duplicateCount++;
            debugLog(`insertSefazReportData: Registro duplicado atualizado: Termo ${numero_termo}, Chave NFe ${chave_nfe}`);
            processedTermos.push(numero_termo); // Também conciliar atualizados
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          debugWarn(`insertSefazReportData: Entrada duplicada para chave_nfe: ${chave_nfe}. (Erro: ${error.message})`);
          duplicateCount++;
          // Se for uma duplicata, não adiciona a processedTermos, pois já existe no banco.
          // A conciliação será feita posteriormente para todos os termos não conciliados.
        } else if (error.code === 'ER_DATA_TOO_LONG') {
          debugError(`insertSefazReportData: Erro de dados muito longos para coluna: ${error.sqlMessage}. Dado: ${JSON.stringify(row)}`);
        }
        else {
          debugError(`insertSefazReportData: Erro INESPERADO ao inserir dado em sefaz_report: ${error.message} Dado: ${JSON.stringify(row)}`);
          throw error;
        }
      }
    }
    await connection.commit();
    debugLog(`Total processado: ${totalProcessed}, Inseridos: ${insertedCount}, Duplicados/Atualizados: ${duplicateCount}`);

    // --- CHAMA A FUNÇÃO DE CONCILIAÇÃO APÓS A INSERÇÃO DE SEFAZ_REPORT ---
    // Idealmente, chamar reconcileSefazReportWithFranchise para os termos que acabaram de ser inseridos/atualizados
    // ou para todos os termos ainda sem AWB.
    // Para simplificar agora, vamos re-conciliar todos os AWBs nulos.
    const { reconciledCount } = await reconcileSefazReportWithFranchise(connection); // Passa a conexão da transação
    debugLog(`insertSefazReportData: Conciliados ${reconciledCount} termos com AWB.`);

  } catch (error) {
    await connection.rollback();
    debugError("insertSefazReportData: Erro geral durante o processo de inserção em sefaz_report:", error.message);
    throw error;
  } finally {
    connection.release();
    debugLog('--- Fim de insertSefazReportData ---');
  }
  return { insertedCount, duplicateCount, totalProcessed };
}



async function insertFranchiseReportData(data) {
  debugLog('insertFranchiseReportData: Início da função.');
  debugLog('insertFranchiseReportData: Dados a serem inseridos no franchise_report:', data.length);

  let insertedCount = 0;
  let duplicateCount = 0;
  let updatedCount = 0;
  let totalProcessed = 0;
  const processedAwbs = []; // Para armazenar AWBs que foram inseridos/atualizados

  const currentPool = await getDbPoolInstance();
  const connection = await currentPool.getConnection();
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
      const [awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario] = row;

      if (!awb) {
        debugWarn(`insertFranchiseReportData: Registro com AWB vazio ou inválido pulado no franchise_report: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const [result] = await connection.execute(insertUpdateQuery, [awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario]);

        if (result.affectedRows > 0) {
          if (result.insertId > 0) {
            insertedCount++;
            debugLog(`insertFranchiseReportData: Novo registro inserido no franchise_report: AWB ${awb}`);
            processedAwbs.push(awb); // Adicionar AWB inserido
          } else {
            duplicateCount++;
            updatedCount++;
            debugLog(`insertFranchiseReportData: Registro duplicado atualizado no franchise_report: AWB ${awb}`);
            processedAwbs.push(awb); // Adicionar AWB atualizado
          }
        }
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          debugWarn(`insertFranchiseReportData: Entrada duplicada para AWB: ${awb} em franchise_report. (Erro: ${error.message})`);
          duplicateCount++;
        } else if (error.code === 'ER_DATA_TOO_LONG') {
          debugError(`insertFranchiseReportData: Erro de dados muito longos para coluna. AWB: ${awb}, Erro: ${error.sqlMessage}. Dado: ${JSON.stringify(row)}`);
          throw error;
        }
        else {
          debugError(`insertFranchiseReportData: Erro INESPERADO ao inserir dado em franchise_report: ${error.message} Dado: ${JSON.stringify(row)}`);
          throw error;
        }
      }
    }
    await connection.commit();
    debugLog(`Total processado franchise: ${totalProcessed}, Inseridos: ${insertedCount}, Duplicados/Atualizados: ${updatedCount}`);

    // --- CHAMA A FUNÇÃO DE CONCILIAÇÃO APÓS A INSERÇÃO DE FRANCHISE_REPORT ---
    // Depois de inserir/atualizar AWBs no franchise_report, tentamos re-conciliar
    // termos no sefaz_report que ainda não têm AWB ou que poderiam ter sido
    // atualizados por esses novos dados.
    // Vamos reconciliar todos os termos que ainda não têm AWB.
    const { reconciledCount } = await reconcileSefazReportWithFranchise(connection); // Passa a conexão da transação
    debugLog(`insertFranchiseReportData: Conciliados ${reconciledCount} termos com AWB.`);


  } catch (error) {
    await connection.rollback();
    debugError("insertFranchiseReportData: Erro geral durante o processo de inserção em franchise_report:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de insertFranchiseReportData ---');
  }
  return { insertedCount, duplicateCount, totalProcessed, updatedCount };
}



async function getSefazReportData(filters = {}) {
  debugLog('getSefazReportData: Início da função.');
  const {
    data_emissao,
    chave_mdfe,
    numero_termo,
    chave_nfe,
    numero_cte,
    numero_nfe,
    numero_voo,
    awb,
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
            COALESCE(
                (SELECT fr1.awb FROM franchise_report fr1 WHERE LPAD(sr.numero_cte, 9, '0') = SUBSTR(fr1.chave_cte, 26, 9) LIMIT 1),
                (SELECT fr2.awb FROM franchise_report fr2 WHERE sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND fr2.notas IS NOT NULL AND fr2.notas != '' AND sr.numero_nfe = LTRIM(REPLACE(fr2.notas, '0', ' ')) LIMIT 1),
                (SELECT fr_parcial.awb FROM franchise_report fr_parcial WHERE fr_parcial.chave_cte LIKE CONCAT('%', sr.numero_cte, '%') AND LENGTH(sr.numero_cte) > 0 LIMIT 1)
            ) AS awb,
            fr.chave_cte AS fr_chave_cte,
            fr.origem,
            fr.destino,
            fr.tomador,
            fr.notas AS fr_notas,
            fr.data_emissao AS fr_data_emissao,
            fr.destinatario
        FROM sefaz_report sr
        LEFT JOIN franchise_report fr
        ON sr.numero_voo = fr.numero_voo
        AND (
            sr.numero_cte = fr.awb
            OR
            (
                sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND
                fr.notas IS NOT NULL AND fr.notas != '' AND
                sr.numero_nfe = LTRIM(REPLACE(fr.notas, '0', ' '))
            )
        )
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
    debugLog(`getSefazReportData: Dados recuperados: ${rows.length} linhas.`);
    return rows;
  } catch (error) {
    debugError("getSefazReportData: Erro ao buscar dados:", error);
    throw error;
  } finally {
    debugLog('--- Fim de getSefazReportData ---');
  }
}

async function getFranchiseReportData(filters = {}) {
  debugLog('getFranchiseReportData: Início da função.');
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
    query += ` AND data_emissao = STR_TO_DATE(?, '%d/%m/%Y')`;
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
    debugLog(`getFranchiseReportData: Dados recuperados: ${rows.length} linhas.`);
    return rows;
  } catch (error) {
    debugError("getFranchiseReportData: Erro ao buscar dados:", error);
    throw error;
  } finally {
    debugLog('--- Fim de getFranchiseReportData ---');
  }
}

async function insertLog(logData) {
  debugLog('insertLog: Início da função.');
  const { action, user_ip = null, mac_address = null, user_agent = null, details = null, success = true } = logData;
  let connection;
  try {
    const currentPool = await getDbPoolInstance();
    connection = await currentPool.getConnection();
    const [result] = await connection.execute(
      `
            INSERT INTO logs (action, user_ip, mac_address, user_agent, details, success)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
      [action, user_ip, mac_address, user_agent, details, success]
    );
    debugLog(`insertLog: Log inserido: ${action} - ID: ${result.insertId}`);
  } catch (error) {
    debugError(`insertLog: Erro ao inserir log: ${error.message} LogData: ${JSON.stringify(logData)}`);
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de insertLog ---');
  }
}

async function getLastFranchiseImportDate() {
  debugLog('getLastFranchiseImportDate: Início da função.');
  let connection;
  try {
    const currentPool = await getDbPoolInstance();
    connection = await currentPool.getConnection();
    const [rows] = await connection.execute(
      `SELECT MAX(data_registro) AS last_date FROM franchise_report`
    );
    const lastDate = rows[0].last_date;
    debugLog('getLastFranchiseImportDate: Última data de importação de franchise:', lastDate);
    return lastDate;
  } catch (error) {
    debugError(`getLastFranchiseImportDate: Erro ao buscar última data de importação de franchise: ${error.message}`);
    return null;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de getLastFranchiseImportDate ---');
  }
}

async function insertOrUpdateSefazStatusTermos(data) {
  debugLog('insertOrUpdateSefazStatusTermos: Início da função.');
  debugLog('insertOrUpdateSefazStatusTermos: Dados a serem inseridos/atualizados em sefaz_status_termos:', data.length);

  let insertedCount = 0;
  let updatedCount = 0;
  let totalProcessed = 0;

  const currentPool = await getDbPoolInstance();
  const connection = await currentPool.getConnection();
  try {
    await connection.beginTransaction();

    const insertUpdateQuery = `
            INSERT INTO sefaz_status_termos (numero_termo, data_status, situacao, valor, data_registro)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                data_status = VALUES(data_status),
                situacao = VALUES(situacao),
                valor = VALUES(valor),
                data_registro = NOW();
        `;

    for (const row of data) {
      totalProcessed++;
      const [numero_termo, data_status, situacao, valor_final_para_db] = row;

      if (!numero_termo) {
        debugWarn(`insertOrUpdateSefazStatusTermos: Registro com numero_termo vazio pulado: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const [result] = await connection.execute(insertUpdateQuery, [numero_termo, data_status, situacao, valor_final_para_db]);

        if (result.affectedRows === 1) {
          insertedCount++;
          debugLog(`insertOrUpdateSefazStatusTermos: Novo status de termo inserido: ${numero_termo}`);
        } else if (result.affectedRows === 2) {
          updatedCount++;
          debugLog(`insertOrUpdateSefazStatusTermos: Status de termo atualizado: ${numero_termo}`);
        }
      } catch (error) {
        debugError(`insertOrUpdateSefazStatusTermos: Erro ao inserir/atualizar status de termo: ${error.message} Dado: ${JSON.stringify(row)}`);
        throw error;
      }
    }
    await connection.commit();
    debugLog(`insertOrUpdateSefazStatusTermos: Total processado status termos: ${totalProcessed}, Inseridos: ${insertedCount}, Atualizados: ${updatedCount}`);
  } catch (error) {
    await connection.rollback();
    debugError("insertOrUpdateSefazStatusTermos: Erro geral durante a inserção/atualização de status de termos:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    debugLog('--- Fim de insertOrUpdateSefazStatusTermos ---');
  }
  return { insertedCount, updatedCount, totalProcessed };
}


/**
 * Tenta conciliar entradas na sefaz_report com awb da franchise_report.
 * Usa as lógicas de COALESCE baseadas em numero_cte ou numero_nfe para encontrar o AWB.
 * @param {mysql.PoolConnection} connection - A conexão ativa do pool.
 * @param {string|null} specificTermo - Opcional. Se fornecido, concilia apenas para este numero_termo.
 * @param {string|null} specificAwb - Opcional. Se fornecido, concilia apenas para termos que se relacionam a este AWB.
 * @returns {Promise<{ reconciledCount: number }>}
 */
async function reconcileSefazReportWithFranchise(connection, specificTermo = null, specificAwb = null) {
  debugLog('reconcileSefazReportWithFranchise: Início da função.');
  let reconciledCount = 0;

  let query = `
        UPDATE sefaz_report sr
        SET sr.awb = COALESCE(
            (SELECT fr1.awb FROM franchise_report fr1 WHERE LPAD(sr.numero_cte, 9, '0') = SUBSTR(fr1.chave_cte, 26, 9) LIMIT 1),
            (SELECT fr2.awb FROM franchise_report fr2 WHERE sr.numero_nfe IS NOT NULL AND sr.numero_nfe != '' AND fr2.notas IS NOT NULL AND fr2.notas != '' AND sr.numero_nfe = LTRIM(REPLACE(fr2.notas, '0', ' ')) LIMIT 1),
            (SELECT fr_parcial.awb FROM franchise_report fr_parcial WHERE fr_parcial.chave_cte LIKE CONCAT('%', sr.numero_cte, '%') AND LENGTH(sr.numero_cte) > 0 LIMIT 1)
        )
        WHERE sr.awb IS NULL OR sr.awb = '';
    `;
  const params = [];

  if (specificTermo) {
    query += ` AND sr.numero_termo = ?`;
    params.push(specificTermo);
  }
  if (specificAwb) {
    // Se um AWB específico foi importado/atualizado no franchise,
    // queremos re-conciliar termos que poderiam se ligar a ele.
    // Isso é mais complexo, pois a conciliação usa numero_cte ou numero_nfe para encontrar o AWB.
    // Para simplificar, faremos uma re-conciliação mais ampla ou confiaremos na lógica de "AWB IS NULL".
    // Por agora, o filtro specificAwb não será direto nesta query UPDATE.
    // O melhor é fazer uma re-conciliação para todos os termos não-conciliados
    // ou para um conjunto de termos potencialmente afetados.
    debugWarn(`reconcileSefazReportWithFranchise: 'specificAwb' parameter is not directly used in UPDATE query logic for now.`);
  }

  try {
    const [result] = await connection.execute(query, params);
    reconciledCount = result.affectedRows;
    debugLog(`reconcileSefazReportWithFranchise: ${reconciledCount} registros da sefaz_report conciliados/atualizados.`);
  } catch (error) {
    debugError(`reconcileSefazReportWithFranchise: Erro durante a conciliação: ${error.message}`);
    throw error;
  } finally {
    debugLog('reconcileSefazReportWithFranchise: Fim da função.');
  }
  return { reconciledCount };
}

module.exports = {
  initializeDatabase,
  getDbPoolInstance,
  insertSefazReportData,
  insertFranchiseReportData,
  getSefazReportData,
  getFranchiseReportData,
  insertLog,
  getLastFranchiseImportDate,
  waitForDatabaseTables,
  insertOrUpdateSefazStatusTermos,
  reconcileSefazReportWithFranchise, // <-- EXPOR A NOVA FUNÇÃO
  debugLog,
  debugWarn,
  debugError
};
