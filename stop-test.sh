#!/bin/bash
echo "Parando ambiente de TESTE..."
docker-compose -p intranettest -f docker-compose.test.yml --env-file .env.test down