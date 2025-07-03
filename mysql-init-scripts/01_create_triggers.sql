-- mysql-init-scripts/01_create_triggers.sql

-- Usamos USE para garantir que a trigger seja criada no banco de dados correto.
-- A variável ${DB_NAME} será o nome do banco que o Docker cria automaticamente.
-- O script de entrada do Docker não lida bem com a troca de delimitador,
-- então vamos criar um procedimento para conter a lógica e depois removê-lo.

DROP PROCEDURE IF EXISTS create_trigger_proc;

DELIMITER //
CREATE PROCEDURE create_trigger_proc()
BEGIN
    -- Remove a trigger se já existir, para idempotência
    DROP TRIGGER IF EXISTS trg_sefaz_report_after_awb_update;

    -- Cria a nova trigger
    CREATE TRIGGER trg_sefaz_report_after_awb_update
    AFTER UPDATE ON sefaz_report
    FOR EACH ROW
    BEGIN
        IF OLD.awb IS NULL AND NEW.awb IS NOT NULL AND NEW.awb != '' THEN
            INSERT INTO azul_movimentacao_awb (awb, status_atual, data_status_atual, acao, observacao, email_enviado)
            VALUES (NEW.awb, 'Pendente', NOW(), 'Pendente', '', FALSE);
        END IF;
    END;
END //
DELIMITER ;

-- Chama o procedimento para criar a trigger
CALL create_trigger_proc();

-- Remove o procedimento após a execução
DROP PROCEDURE IF EXISTS create_trigger_proc;