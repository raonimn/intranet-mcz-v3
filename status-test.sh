#!/bin/bash
echo "Verificando status do ambiente de TESTE..."
docker-compose -f docker-compose.test.yml --env-file .env.test ps