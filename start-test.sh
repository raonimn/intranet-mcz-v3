#!/bin/bash
echo "Iniciando ambiente de TESTE..."
docker-compose -f docker-compose.test.yml --env-file .env.test up --build -d