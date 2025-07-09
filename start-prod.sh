#!/bin/bash
# 'set -e' faz com que o script pare imediatamente se algum comando falhar.
set -e

echo "➡️  Iniciando atualização do ambiente de PRODUÇÃO..."

# O comando 'up' com '--build' já reconstrói e recria se necessário.
# Adicionar '--force-recreate' é uma garantia extra de que os containers
# serão substituídos, evitando qualquer estado antigo.
echo "🚀  Construindo nova imagem e (re)criando os containers..."
docker-compose -p intranetprod -f docker-compose.prod.yml --env-file .env.prod up --build --force-recreate -d

# Passo opcional, mas recomendado para produção: limpar imagens antigas
# que não estão mais sendo usadas por nenhum container.
echo "🧹  Limpando imagens Docker antigas e não utilizadas..."
docker image prune -af

echo "✅  Ambiente de PRODUÇÃO atualizado e rodando com sucesso!"