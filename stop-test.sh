#!/bin/bash
echo "Parando ambiente de TESTE..."
docker-compose -f docker-compose.test.yml --env-file .env.test down