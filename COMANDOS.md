# AJUDA_COMANDOS.md

Este arquivo é uma folha de consulta rápida para os comandos Docker mais comuns neste projeto.

## Permissões de Scripts
Lembre-se que todos os arquivos `.sh` precisam de permissão de execução. Rode este comando uma vez para todos eles.
```bash
chmod +x *.sh
```

---

## Gerenciamento do Ambiente de PRODUÇÃO
- **Projeto:** `intranetprod`
- **URL:** `http://192.168.0.217` (ou seu domínio de produção)

#### Comandos Básicos
- **Iniciar ou Atualizar o Ambiente:**
  ```bash
  ./start-prod.sh
  ```
- **Parar o Ambiente:**
  ```bash
  ./stop-prod.sh
  ```
- **Verificar Status dos Serviços:**
  ```bash
  ./status-prod.sh
  ```

#### Comandos de Debug
- **Ver Logs em Tempo Real do Backend:**
  ```bash
  docker-compose -p intranetprod -f docker-compose.prod.yml logs -f --tail=100 backend
  ```
- **Ver Logs em Tempo Real do Frontend (Nginx):**
  ```bash
  docker-compose -p intranetprod -f docker-compose.prod.yml logs -f --tail=100 frontend
  ```

---

## Gerenciamento do Ambiente de TESTE
- **Projeto:** `intranettest`
- **URL:** `http://192.168.0.217:8081`

#### Comandos Básicos
- **Iniciar ou Atualizar o Ambiente:**
  ```bash
  ./start-test.sh
  ```
- **Parar o Ambiente:**
  ```bash
  ./stop-test.sh
  ```
- **Verificar Status dos Serviços:**
  ```bash
  ./status-test.sh
  ```

#### Comandos de Debug
- **Ver Logs em Tempo Real do Backend:**
  ```bash
  docker-compose -p intranettest -f docker-compose.test.yml logs -f --tail=100 backend
  ```
- **Ver Logs em Tempo Real do Frontend (Nginx):**
  ```bash
  docker-compose -p intranettest -f docker-compose.test.yml logs -f --tail=100 frontend
  ```

#### Resetar o Ambiente de Teste (Zerar o Banco de Dados)
Use esta sequência de comandos para destruir e recriar o ambiente de teste com um banco de dados limpo. Isso é útil para testar scripts de inicialização (como as triggers) ou começar um teste do zero.

```bash
# Passo 1: Parar completamente o ambiente de teste
./stop-test.sh

# Passo 2: Remover o volume de dados do banco de teste (CUIDADO: ESTA AÇÃO É IRREVERSÍVEL)
echo "Removendo volume do banco de dados de teste..."
docker volume rm intranettest_mysql_data_test

# Passo 3: Iniciar o ambiente novamente. O banco será recriado do zero.
./start-test.sh
```

---

## Comandos Gerais do Docker

- **Listar todos os containers em execução:**
  ```bash
  docker ps
  ```

- **Acessar o terminal de um container (ex: backend de teste):**
  ```bash
  # Primeiro, encontre o nome exato do container com "docker ps" (ex: intranettest_backend_1)
  docker exec -it intranettest_backend_1 bash
  ```

- **Listar todos os volumes do Docker:**
  ```bash
  docker volume ls
  ```

- **Limpar redes não utilizadas:**
  ```bash
  docker network prune -f
  ```

- **Forçar a parada e remoção de TODOS os containers deste projeto (Útil para resolver conflitos):**
  ```bash
  docker stop $(docker ps -a -q --filter "name=intranet") && docker rm $(docker ps -a -q --filter "name=intranet")
  ```
