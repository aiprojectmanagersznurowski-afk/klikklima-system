#!/usr/bin/env bash
# Podpina .githooks/ jako katalog hooków repozytorium.
# Wersjonowany katalog zamiast .git/hooks — dzięki temu hook jest w repo
# i działa u każdego, kto sklonuje projekt, a nie tylko u Ciebie.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
chmod +x .githooks/*
echo "✓ core.hooksPath = .githooks"
echo "  Sprawdź: git config core.hooksPath"
