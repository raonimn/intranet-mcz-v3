#!/bin/bash
echo "Iniciando ambiente de PRODUÇÃO..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod up --build -d