#!/bin/bash
echo "Verificando status do ambiente de TESTE (projeto: intranettest)..."
docker-compose -p intranettest -f docker-compose.test.yml --env-file .env.test ps