#!/bin/bash
echo "Iniciando ambiente de PRODUÇÃO..."
docker-compose -p intranetprod -f docker-compose.prod.yml --env-file .env.prod up --build -d