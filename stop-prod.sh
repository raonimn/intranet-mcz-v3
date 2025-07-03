#!/bin/bash
echo "Parando ambiente de PRODUÇÃO..."
docker-compose -f docker-compose.prod.yml --env-file .env.prod down