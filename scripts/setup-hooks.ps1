# scripts/setup-hooks.ps1
# Instala o hook pre-push no repositório local.
# Executar UMA VEZ após clonar o repositório:
#   pwsh -File scripts/setup-hooks.ps1

$hook = @'
#!/bin/sh
# Hook pre-push — atualiza CLAUDE.md com metadados do push atual
ROOT=$(git rev-parse --show-toplevel)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ROOT/scripts/update-claude.ps1"
git add CLAUDE.md
git diff --staged --quiet CLAUDE.md 2>/dev/null || git commit --no-verify -m "docs: sync CLAUDE.md [auto]"
exit 0
'@

$path = '.git/hooks/pre-push'
[System.IO.File]::WriteAllText($path, $hook, (New-Object System.Text.UTF8Encoding $false))

# Tornar executável no Git bash (Windows)
& git update-index --chmod=+x $path 2>$null

Write-Host "Hook instalado em: $path"
Write-Host "Teste: git push (deve atualizar CLAUDE.md automaticamente)"
