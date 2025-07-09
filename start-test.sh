#!/bin/bash
# 'set -e' faz com que o script pare imediatamente se algum comando falhar.
set -e

echo "➡️  Iniciando atualização do ambiente de TESTE..."

# O comando 'up' com '--build' já reconstrói e recria se necessário.
# Adicionar '--force-recreate' é uma garantia extra de que os containers
# serão substituídos, evitando qualquer estado antigo.
echo "🚀  Construindo nova imagem e (re)criando os containers..."
docker-compose -p intranettest -f docker-compose.test.yml --env-file .env.test up --build --force-recreate -d
# Passo opcional, mas recomendado para produção: limpar imagens antigas
# que não estão mais sendo usadas por nenhum container.
echo "🧹  Limpando imagens Docker antigas e não utilizadas..."
docker image prune -af

echo "✅  Ambiente de TESTE atualizado e rodando com sucesso!"