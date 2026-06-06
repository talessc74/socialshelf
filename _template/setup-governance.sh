#!/usr/bin/env bash
# setup-governance.sh
# Instala a estrutura de governança ARGUS em qualquer projeto.
# Uso: bash setup-governance.sh [caminho-do-projeto]
# Sem argumento: instala no diretório atual.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-.}"

if [ ! -d "$TARGET" ]; then
  echo "Erro: diretório '$TARGET' não encontrado."
  exit 1
fi

echo "Instalando governança ARGUS em: $TARGET"

# Cria .seeds/ se não existir
mkdir -p "$TARGET/.seeds"

# Copia CLAUDE.md (não sobrescreve se já existir)
if [ -f "$TARGET/CLAUDE.md" ]; then
  echo "  ⚠️  CLAUDE.md já existe. Salvando backup em CLAUDE.md.bak"
  cp "$TARGET/CLAUDE.md" "$TARGET/CLAUDE.md.bak"
fi
cp "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
echo "  ✓ CLAUDE.md"

# Copia todos os arquivos de .seeds/
for f in "$SCRIPT_DIR/.seeds/"*; do
  fname="$(basename "$f")"
  cp "$f" "$TARGET/.seeds/$fname"
  echo "  ✓ .seeds/$fname"
done

echo ""
echo "Governança instalada com sucesso."
echo "Próximo passo: abra o projeto com Claude Code."
echo "ARGUS já está de olho."
