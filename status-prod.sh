#!/bin/bash
echo "Verificando status do ambiente de PRODUÇÃO..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod ps