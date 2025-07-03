# Passo 1: Parar completamente o ambiente de teste
./stop-test.sh

# Passo 2: Remover o volume de dados do banco de teste (CUIDADO: ESTA AÇÃO É IRREVERSÍVEL)
echo "Removendo volume do banco de dados de teste..."
docker volume rm intranettest_mysql_data_test

# Passo 3: Iniciar o ambiente novamente. O banco será recriado do zero.
./start-test.sh