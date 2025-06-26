// backend/database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-DB]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-DB]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-DB]', ...args); }; // Erros sempre logados

const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './dados.db');

// Função para criar uma nova conexão do banco de dados (usada por todas as outras)
const createConnection = () => {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      debugError('Erro ao conectar ao banco de dados:', err.message);
    } else {
      debugLog('Conectado ao banco de dados:', dbPath);
    }
  });
};

// --- FUNÇÕES DE CRIAÇÃO DE TABELAS CONSOLIDADAS ---

// Função para criar a tabela franchise_report (para dados XLSX)
const createFranchiseReportTable = () => {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS franchise_report (
                awb TEXT PRIMARY KEY,
                chave_cte TEXT,
                origem TEXT,
                destino TEXT,
                destinatario TEXT,
                tomador TEXT,
                notas TEXT
            );
        `;

    db.run(createTableQuery, (err) => {
      if (err) {
        debugError('Erro ao criar a tabela franchise_report:', err.message);
        reject(err);
      } else {
        debugLog('Tabela franchise_report criada com sucesso ou já existente.');
        resolve();
      }
      db.close((err) => {
        if (err) debugError('Erro ao fechar conexão após createFranchiseReportTable:', err.message);
      });
    });
  });
};

// Função para criar a tabela sefaz_report (anteriormente 'dados', para dados PDF)
const createSefazReportTable = () => {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS sefaz_report (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_emissao TEXT,
                chave_mdfe TEXT,
                numero_termo TEXT,
                chave_nfe TEXT UNIQUE,
                numero_cte TEXT,
                numero_nfe TEXT,
                numero_voo TEXT,
                data_registro TEXT
            );
        `;

    db.run(createTableQuery, (err) => {
      if (err) {
        debugError("Erro ao criar tabela sefaz_report:", err.message);
        reject(err);
      } else {
        debugLog("Tabela sefaz_report criada com sucesso ou já existente.");
        // Trigger creation (moved here for consistency)
        db.run(`
                    CREATE TRIGGER IF NOT EXISTS evitar_duplicatas
                    BEFORE INSERT ON sefaz_report
                    WHEN EXISTS (SELECT 1 FROM sefaz_report WHERE chave_nfe = NEW.chave_nfe)
                    BEGIN
                        SELECT RAISE(ABORT, 'Inserção cancelada. chave_nfe duplicada.');
                    END;
                `, (err) => {
          if (err) {
            debugError("Erro ao criar trigger 'evitar_duplicatas' para sefaz_report:", err.message);
            reject(err);
          } else {
            debugLog("Trigger 'evitar_duplicatas' para sefaz_report criada ou já existente.");
            resolve();
          }
          db.close((err) => {
            if (err) debugError('Erro ao fechar conexão após createSefazReportTable:', err.message);
          });
        });
      }
    });
  });
};


// Função para inserir ou atualizar dados na tabela franchise_report
const insertOrUpdateFranchiseReport = (dados) => {
  return new Promise((resolve, reject) => {
    debugLog('--- Início de insertOrUpdateFranchiseReport ---');
    debugLog(`Recebidos ${dados.length} registros para processamento.`);

    if (dados.length === 0) {
      debugWarn('Nenhum dado para inserir/atualizar.');
      return resolve();
    }

    const db = createConnection(); // Conexão específica para esta operação

    db.serialize(() => { // Garante que as operações SQL dentro do serialize rodem em sequência
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) {
          debugError('Erro ao iniciar transação para franchise_report:', err.message);
          db.close(); // Fecha a conexão em caso de falha ao iniciar transação
          return reject(err);
        }
        debugLog('Transação para franchise_report iniciada.');

        const stmt = db.prepare(`
                    INSERT OR REPLACE INTO franchise_report (awb, chave_cte, origem, destino, destinatario, tomador, notas)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                `);

        let completedOperations = 0;
        let hasFatalError = false; // Sinaliza um erro que exige rollback

        // Usamos um for...of com async/await para garantir que cada stmt.run() complete
        // antes do próximo, garantindo que completedOperations e hasFatalError sejam precisos.
        // Isso também evita o problema de 'SQLITE_BUSY' no finalize/commit.
        (async () => {
          try {
            for (const dado of dados) {
              if (hasFatalError) break; // Interrompe o loop se um erro fatal já ocorreu

              const awb = dado[0];
              const chave_cte = dado[1];
              const origem = dado[2];
              const destino = dado[3];
              const destinatario = dado[4];
              const tomador = dado[5];
              const notas = dado[6];

              if (!awb || !chave_cte) {
                debugWarn(`Dado incompleto ou inválido no índice para franchise_report. AWB: '${awb}', Chave CT-e: '${chave_cte}'. Pulando registro.`);
                completedOperations++;
                continue; // Pula para o próximo item no loop
              }

              await new Promise((res, rej) => {
                debugLog(`Tentando inserir/atualizar AWB: ${awb}, Chave CT-e: ${chave_cte}`);
                stmt.run(awb, chave_cte, origem, destino, destinatario, tomador, notas, function (runErr) {
                  if (runErr) {
                    if (runErr.message.includes('SQLITE_CONSTRAINT_PRIMARYKEY') || runErr.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
                      debugWarn(`Entrada duplicada ou PK inválida para AWB: ${awb}. Inserção ignorada.`);
                      res(); // Resolve para continuar o loop, mas não houve inserção 'nova'
                    } else {
                      debugError('Erro FATAL ao inserir dados na tabela franchise_report:', runErr.message, 'Dados:', dado);
                      hasFatalError = true;
                      rej(runErr); // Rejeita a Promise para ser pego pelo catch externo
                    }
                  } else {
                    debugLog(`Registro inserido/atualizado (temporário) para AWB: ${awb}`);
                    res(); // Resolve para continuar o loop
                  }
                });
              });
              completedOperations++; // Incrementa após a Promise ser resolvida/rejeitada
            }

            // Finaliza o statement e faz o commit/rollback
            stmt.finalize((finalizeErr) => {
              if (finalizeErr) {
                debugError('Erro ao finalizar statement na tabela franchise_report:', finalizeErr.message);
                db.run('ROLLBACK', () => { // Rollback se falha na finalização
                  db.close();
                  reject(finalizeErr);
                });
                return;
              }
              debugLog('Statement finalizado para franchise_report.');

              if (hasFatalError) { // Se um erro fatal ocorreu durante o loop
                db.run('ROLLBACK', () => {
                  debugLog('Rollback da transação franchise_report realizado devido a erro fatal.');
                  db.close();
                  reject(new Error("Inserção de dados em franchise_report falhou devido a erro(s)."));
                });
              } else { // Se tudo correu bem
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    debugError('Erro ao fazer commit da transação franchise_report:', commitErr.message);
                    db.close();
                    reject(commitErr);
                  } else {
                    debugLog(`${dados.length} registros processados para inserção/atualização na tabela franchise_report. Commit bem-sucedido.`);
                    db.close();
                    resolve();
                  }
                });
              }
            });

          } catch (loopOrFinalizeError) {
            debugError("Erro geral no insertOrUpdateFranchiseReport ou durante finalização:", loopOrFinalizeError.message);
            if (!hasFatalError) { // Evita múltiplos rollbacks
              db.run('ROLLBACK', () => {
                db.close();
                reject(loopOrFinalizeError);
              });
            }
          }
        })(); // Chama a função async imediatamente
      });
    });
  });
};

// Função para criar a tabela termos_inseridos
const createTermosInseridosTable = () => {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS termos_inseridos (
                numero_termo TEXT PRIMARY KEY
            )
        `;
    db.run(createTableQuery, (err) => {
      if (err) {
        debugError("Erro ao criar tabela termos_inseridos:", err.message);
        reject(err);
      } else {
        debugLog("Tabela termos_inseridos criada com sucesso ou já existente.");
        resolve();
      }
      db.close((err) => {
        if (err) debugError('Erro ao fechar conexão após createTermosInseridosTable:', err.message);
      });
    });
  });
};

// Função para limpar a tabela de termos inseridos
const clearTermosInseridosTable = () => {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    db.run("DELETE FROM termos_inseridos", (err) => {
      if (err) {
        debugError("Erro ao limpar tabela termos_inseridos:", err.message);
        reject(err);
      } else {
        debugLog("Tabela termos_inseridos limpa com sucesso.");
        resolve();
      }
      db.close((err) => {
        if (err) debugError('Erro ao fechar conexão após clearTermosInseridosTable:', err.message);
      });
    });
  });
};

// Função para inserir um novo termo na tabela de termos inseridos
const insertNumeroTermo = (numero_termo) => {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    db.run("INSERT OR REPLACE INTO termos_inseridos (numero_termo) VALUES (?)", [numero_termo], function (err) {
      if (err) {
        if (err.message.includes('SQLITE_CONSTRAINT_PRIMARYKEY')) {
          debugWarn(`Número de termo '${numero_termo}' já existe. Ignorando inserção.`);
          resolve(); // Considera sucesso se já existe
        } else {
          debugError("Erro ao inserir número de termo:", err.message);
          reject(err);
        }
      } else {
        debugLog(`Número de termo '${numero_termo}' inserido com sucesso.`);
        resolve();
      }
      db.close((err) => {
        if (err) debugError('Erro ao fechar conexão após insertNumeroTermo:', err.message);
      });
    });
  });
};

// Nova função para inserir dados na tabela sefaz_report (anteriormente insertDadosSQLite)
const insertSefazReportData = (dados, numeroVoo, dataRegistro) => {
  return new Promise((resolve, reject) => {
    debugLog('--- Início de insertSefazReportData ---');
    debugLog('Dados a serem inseridos:', dados);
    debugLog('Número do Voo para inserção:', numeroVoo);
    debugLog('Data de Registro para inserção:', dataRegistro);

    if (dados.length === 0) {
      debugWarn('Nenhum dado de PDF para inserir.');
      return resolve();
    }

    const db = createConnection(); // Conexão específica para esta operação

    db.serialize(async () => {
      db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          debugError("Erro ao iniciar transação para sefaz_report:", err.message);
          db.close(); // Fecha a conexão em caso de falha ao iniciar transação
          return reject(err);
        }
        debugLog('Transação para sefaz_report iniciada.');

        const stmt = db.prepare(`
                    INSERT INTO sefaz_report (data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe, numero_voo, data_registro)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

        let hasFatalError = false; // Sinaliza um erro que exige rollback

        try {
          for (const dado of dados) {
            if (hasFatalError) break; // Interrompe o loop se um erro fatal já ocorreu

            if (dado.length !== 6) {
              debugWarn(`Dado de PDF incompleto pulado: Esperava 6 elementos, mas encontrou ${dado.length}. Dado:`, dado);
              continue; // Pula para o próximo item no loop
            }

            await new Promise((res, rej) => {
              debugLog('Verificando dado para inserção em sefaz_report. Chave MDF-e:', dado[1], 'Dado completo:', dado);
              stmt.run(dado[0], dado[1], dado[2], dado[3], dado[4], dado[5], numeroVoo, dataRegistro, function (runErr) {
                if (runErr) {
                  if (runErr.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
                    debugWarn(`Entrada duplicada para chave_nfe: ${dado[3]} em sefaz_report. Inserção ignorada.`);
                    res(); // Resolve a Promise para que o `await` continue
                  } else {
                    debugError("Erro FATAL ao inserir dado em sefaz_report:", runErr.message, 'Dado:', dado);
                    hasFatalError = true;
                    rej(runErr); // Rejeita a Promise para ser pego pelo catch externo
                  }
                } else {
                  debugLog('Dado em sefaz_report inserido com sucesso (temporário): Chave NF-e:', dado[3]);
                  res(); // Resolve a Promise no sucesso
                }
              });
            });
          }

          // Finaliza o statement e faz o commit/rollback
          stmt.finalize((finalizeErr) => {
            if (finalizeErr) {
              debugError("Erro ao finalizar statement em sefaz_report:", finalizeErr.message);
              db.run('ROLLBACK', () => { // Rollback se falha na finalização
                db.close();
                reject(finalizeErr);
              });
              return;
            }
            debugLog('Statement para sefaz_report finalizado.');

            if (hasFatalError) { // Se um erro fatal ocorreu durante o loop
              db.run('ROLLBACK', () => {
                debugLog('Rollback da transação sefaz_report realizado devido a erro fatal.');
                db.close();
                reject(new Error("Inserção de dados em sefaz_report falhou devido a erro(s)."));
              });
            } else { // Se tudo correu bem
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  debugError("Erro ao fazer commit para sefaz_report:", commitErr.message);
                  db.close();
                  reject(commitErr);
                } else {
                  debugLog(`Registros processados para inserção em sefaz_report. Commit bem-sucedido.`);
                  db.close();
                  resolve();
                }
              });
            }
          });

        } catch (loopOrFinalizeError) {
          debugError("Erro geral no insertSefazReportData ou durante finalização:", loopOrFinalizeError.message);
          if (!hasFatalError) { // Evita múltiplos rollbacks
            db.run('ROLLBACK', () => {
              db.close();
              reject(loopOrFinalizeError);
            });
          }
        }
      });
    });
  });
};

// Exporta as funções
// Exporta as funções
module.exports = {
  createConnection,
  createFranchiseReportTable,
  createSefazReportTable,       // <-- ADICIONE ESTA LINHA
  createTermosInseridosTable,   // <-- ADICIONE ESTA LINHA
  clearTermosInseridosTable,    // <-- ADICIONE ESTA LINHA
  insertNumeroTermo,            // <-- ADICIONE ESTA LINHA
  insertOrUpdateFranchiseReport,
  insertSefazReportData,        // <-- ADICIONE ESTA LINHA
};