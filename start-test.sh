#!/bin/bash
echo "Iniciando ambiente de TESTE..."
docker-compose -p intranettest -f docker-compose.test.yml --env-file .env.test up --build -d