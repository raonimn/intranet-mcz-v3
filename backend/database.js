// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const LOG_DEBUG = process.env.LOG_DEBUG_MODE === 'true';

const debugLog = (...args) => { if (LOG_DEBUG) { console.log('[DEBUG-DB]', ...args); } };
const debugWarn = (...args) => { if (LOG_DEBUG) { console.warn('[DEBUG-DB]', ...args); } };
const debugError = (...args) => { console.error('[ERROR-DB]', ...args); }; // Erros sempre logados

const dbPath = path.resolve(__dirname, process.env.DATABASE_PATH || './dados.db');

const createConnection = () => {
    return new sqlite3.Database(dbPath, (err) => {
        if (err) { debugError('Erro ao conectar ao banco de dados:', err.message); }
        else { debugLog('Conectado ao banco de dados:', dbPath); }
    });
};

const createFranchiseReportTable = () => {
    return new Promise((resolve, reject) => {
        const db = createConnection();
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS franchise_report (
                awb TEXT PRIMARY KEY,
                chave_cte TEXT,
                origem TEXT,
                destino TEXT,
                tomador TEXT,
                notas TEXT,
                data_emissao TEXT,
                destinatario TEXT
            );
        `;
        db.run(createTableQuery, (err) => {
            if (err) { debugError('Erro ao criar a tabela franchise_report:', err.message); reject(err); }
            else { debugLog('Tabela franchise_report criada com sucesso ou já existente.'); resolve(); }
            db.close((err) => { if (err) debugError('Erro ao fechar conexão após createFranchiseReportTable:', err.message); });
        });
    });
};

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
            if (err) { debugError("Erro ao criar tabela sefaz_report:", err.message); reject(err); }
            else {
                debugLog("Tabela sefaz_report criada com sucesso ou já existente.");
                db.run(`
                    CREATE TRIGGER IF NOT EXISTS evitar_duplicatas_sefaz
                    BEFORE INSERT ON sefaz_report
                    WHEN EXISTS (SELECT 1 FROM sefaz_report WHERE chave_nfe = NEW.chave_nfe)
                    BEGIN
                        SELECT RAISE(ABORT, 'Inserção cancelada. chave_nfe duplicada em sefaz_report.');
                    END;
                `, (err) => {
                    if (err) { debugError("Erro ao criar trigger 'evitar_duplicatas_sefaz' para sefaz_report:", err.message); reject(err); }
                    else { debugLog("Trigger 'evitar_duplicatas_sefaz' para sefaz_report criada ou já existente."); resolve(); }
                    db.close((err) => { if (err) debugError('Erro ao fechar conexão após createSefazReportTable:', err.message); });
                });
            }
        });
    });
};

const insertSefazReportData = (dados, numeroVoo, dataRegistro) => {
    return new Promise((resolve) => {
        debugLog('--- Início de insertSefazReportData ---');
        debugLog('Dados a serem inseridos:', dados);
        debugLog('Número do Voo para inserção:', numeroVoo);
        debugLog('Data de Registro para inserção:', dataRegistro);

        if (dados.length === 0) {
            debugWarn('Nenhum dado de PDF para inserir.');
            return resolve({ insertedCount: 0, duplicateCount: 0, totalProcessed: 0 });
        }

        const db = createConnection();
        let insertedCount = 0;
        let duplicateCount = 0;
        let totalProcessed = 0;

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', async (err) => {
                if (err) {
                    debugError("Erro ao iniciar transação para sefaz_report:", err.message);
                    db.close();
                    return resolve({ insertedCount: 0, duplicateCount: 0, totalProcessed: 0 });
                }
                debugLog('Transação para sefaz_report iniciada.');

                const stmt = db.prepare(`
                    INSERT INTO sefaz_report (data_emissao, chave_mdfe, numero_termo, chave_nfe, numero_cte, numero_nfe, numero_voo, data_registro)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                try {
                    for (const dado of dados) {
                        if (dado.length !== 6) {
                            debugWarn(`Dado de PDF incompleto pulado: Esperava 6 elementos, mas encontrou ${dado.length}. Dado:`, dado);
                            continue;
                        }
                        totalProcessed++;

                        await new Promise((res) => {
                            debugLog('Verificando dado para inserção em sefaz_report. Chave NF-e:', dado[3], 'Dado completo:', dado);
                            stmt.run(dado[0], dado[1], dado[2], dado[3], dado[4], dado[5], numeroVoo, dataRegistro, function (runErr) {
                                if (runErr) {
                                    if (runErr.message.includes('SQLITE_CONSTRAINT_UNIQUE') || runErr.message.includes('Inserção cancelada. chave_nfe duplicada em sefaz_report.')) {
                                        debugWarn(`Entrada duplicada para chave_nfe: ${dado[3]} em sefaz_report. Ignorando inserção.`);
                                        duplicateCount++;
                                    } else {
                                        debugError("Erro INESPERADO ao inserir dado em sefaz_report:", runErr.message, 'Dado:', dado);
                                    }
                                } else {
                                    debugLog('Dado em sefaz_report inserido com sucesso (temporário): Chave NF-e:', dado[3]);
                                    insertedCount++;
                                }
                                res();
                            });
                        });
                    }

                    stmt.finalize((finalizeErr) => {
                        if (finalizeErr) {
                            debugError("Erro ao finalizar statement em sefaz_report, realizando rollback:", finalizeErr.message);
                            db.run('ROLLBACK', () => {
                                db.close();
                                resolve({ insertedCount, duplicateCount, totalProcessed });
                            });
                            return;
                        }
                        debugLog('Statement para sefaz_report finalizado.');

                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                debugError("Erro ao fazer commit para sefaz_report:", commitErr.message);
                                db.close();
                                resolve({ insertedCount, duplicateCount, totalProcessed });
                            } else {
                                debugLog(`Transação para sefaz_report commitada com sucesso. Inseridos: ${insertedCount}, Duplicados: ${duplicateCount}, Total Processado: ${totalProcessed}`);
                                db.close();
                                resolve({ insertedCount, duplicateCount, totalProcessed });
                            }
                        });
                    });

                } catch (loopError) {
                    debugError("Erro geral (catch principal) durante o processo de inserção em sefaz_report, realizando rollback:", loopError.message);
                    db.run('ROLLBACK', () => {
                        db.close();
                        resolve({ insertedCount, duplicateCount, totalProcessed });
                    });
                }
            });
        });
    });
};

const insertOrUpdateFranchiseReport = (dados) => {
    return new Promise((resolve, reject) => {
        debugLog('--- Início de insertOrUpdateFranchiseReport ---');
        debugLog(`Recebidos ${dados.length} registros para processamento.`);

        if (dados.length === 0) {
            debugWarn('Nenhum dado para inserir/atualizar em franchise_report.');
            return resolve();
        }

        const db = createConnection();

        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    debugError('Erro ao iniciar transação para franchise_report:', err.message);
                    db.close();
                    return reject(err);
                }
                debugLog('Transação para franchise_report iniciada.');

                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO franchise_report (awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                `);

                let completedOperations = 0;
                let hasFatalError = false;

                (async () => {
                    try {
                        for (const dado of dados) {
                            if (hasFatalError) break;

                            const awb = dado[0];
                            const chave_cte = dado[1];
                            const data_emissao = dado[2];
                            const origem = dado[3];
                            const destino = dado[4];
                            const tomador = dado[5];
                            const notas = dado[6];
                            const destinatario = dado[7];

                            if (!awb || !chave_cte) {
                                debugWarn(`Dado incompleto ou inválido no índice para franchise_report. AWB: '${awb}', Chave CT-e: '${chave_cte}'. Pulando registro.`);
                                completedOperations++;
                                continue;
                            }

                            await new Promise((res, rej) => {
                                debugLog(`Tentando inserir/atualizar AWB: ${awb}, Chave CT-e: ${chave_cte}, Data Emissão: ${data_emissao}`);
                                stmt.run(awb, chave_cte, data_emissao, origem, destino, tomador, notas, destinatario, function(runErr) {
                                    if (runErr) {
                                        if (runErr.message.includes('SQLITE_CONSTRAINT_PRIMARYKEY') || runErr.message.includes('SQLITE_CONSTRAINT_UNIQUE')) {
                                            debugWarn(`Entrada duplicada ou PK inválida para AWB: ${awb} em franchise_report. Inserção ignorada.`);
                                            res(); // Resolve mesmo em caso de duplicidade para continuar a transação
                                        } else {
                                            debugError('Erro FATAL ao inserir dados na tabela franchise_report:', runErr.message, 'Dados:', dado);
                                            hasFatalError = true;
                                            rej(runErr); // Rejeita em caso de erro fatal
                                        }
                                    } else {
                                        debugLog(`Registro inserido/atualizado (temporário) para AWB: ${awb}`);
                                        res();
                                    }
                                });
                            });
                            completedOperations++;
                        }

                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr) {
                                debugError('Erro ao finalizar statement na tabela franchise_report:', finalizeErr.message);
                                db.run('ROLLBACK', () => {
                                    db.close();
                                    reject(finalizeErr);
                                });
                                return;
                            }
                            debugLog('Statement finalizado para franchise_report.');

                            if (hasFatalError) {
                                db.run('ROLLBACK', () => {
                                    debugLog('Rollback da transação franchise_report realizado devido a erro fatal.');
                                    db.close();
                                    reject(new Error("Inserção de dados em franchise_report falhou devido a erro(s)."));
                                });
                            } else {
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
                        if (!hasFatalError) { // Só faz rollback se ainda não houver um erro fatal
                            db.run('ROLLBACK', () => {
                                debugLog('Rollback da transação franchise_report realizado devido a erro inesperado.');
                                db.close();
                                reject(loopOrFinalizeError);
                            });
                        }
                    }
                })();
            });
        });
    });
};


module.exports = {
    createConnection,
    createFranchiseReportTable,
    createSefazReportTable,
    insertOrUpdateFranchiseReport,
    insertSefazReportData,
};