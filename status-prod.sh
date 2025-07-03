#!/bin/bash
echo "Verificando status do ambiente de PRODUÇÃO (projeto: intranetprod)..."
docker-compose -p intranetprod -f docker-compose.prod.yml --env-file .env.prod ps