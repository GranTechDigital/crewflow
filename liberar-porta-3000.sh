#!/bin/bash

echo "🔓 Liberando porta 3000 no firewall..."

# Liberar porta 3000
ufw allow 3000

# Verificar status
echo "📊 Status do firewall:"
ufw status

echo "✅ Porta 3000 liberada!"
echo "🌐 Teste: http://46.202.146.234:3000"