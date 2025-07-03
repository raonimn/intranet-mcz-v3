#!/bin/bash
echo "Parando ambiente de PRODUÇÃO..."
docker-compose -p intranetprod -f docker-compose.prod.yml --env-file .env.prod down