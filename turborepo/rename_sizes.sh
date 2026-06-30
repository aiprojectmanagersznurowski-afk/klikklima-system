#!/bin/bash
find apps/b2c-web -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -exec sed -i '' \
  -e 's/Do 25 m²/Do 20 m²/g' \
  -e 's/Powyżej 50 m²/Powyżej 35 m²/g' \
  -e 's/36-50 m²/26-35 m²_TMP/g' \
  -e 's/26-35 m²/21-25 m²/g' \
  -e 's/26-35 m²_TMP/26-35 m²/g' {} +
