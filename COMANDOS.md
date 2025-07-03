Gerenciamento do Ambiente de PRODUÇÃO
Projeto: intranetprod

URL: http://192.168.0.217 (Porta 80)

Iniciar/Atualizar:

Bash

./start-prod.sh
Parar:

Bash

./stop-prod.sh
Verificar Status dos Serviços:

Bash

./status-prod.sh # Você precisa criar este script!
# Conteúdo para status-prod.sh:
# #!/bin/bash
# docker-compose -p intranetprod -f docker-compose.prod.yml --env-file .env.prod ps
Ver Logs de um Serviço (ex: backend):

Bash

docker-compose -p intranetprod -f docker-compose.prod.yml logs --tail=100 -f backend
Gerenciamento do Ambiente de TESTE
Projeto: intranettest

URL: http://192.168.0.217:8081

Iniciar/Atualizar:

Bash

./start-test.sh
Parar:

Bash

./stop-test.sh
Verificar Status dos Serviços:

Bash

./status-test.sh # Você precisa criar este script!
# Conteúdo para status-test.sh:
# #!/bin/bash
# docker-compose -p intranettest -f docker-compose.test.yml --env-file .env.test ps
Ver Logs de um Serviço (ex: frontend):

Bash

docker-compose -p intranettest -f docker-compose.test.yml logs --tail=100 -f frontend
Comandos Gerais do Docker
Listar todos os containers em execução:

Bash

docker ps
Acessar o terminal de um container (ex: backend de teste):

Bash

docker exec -it intranettest_backend_1 bash
(O nome intranettest_backend_1 pode ser obtido com docker ps)

Listar todos os volumes do Docker:

Bash

docker volume ls
Remover um volume específico (CUIDADO: APAGA DADOS):

Bash

docker volume rm intranettest_mysql_data_test

Não se esqueça de criar os scripts `status-prod.sh` e `status-test.sh` conforme indica