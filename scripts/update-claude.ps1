# scripts/update-claude.ps1
# Atualiza o bloco de metadados no CLAUDE.md.
# Chamado automaticamente pelo hook .git/hooks/pre-commit (o stamp entra no
# próprio commit). Não usa o assunto do commit atual porque, no pre-commit, ele
# ainda não existe — usa apenas data + branch.

$data   = Get-Date -Format 'yyyy-MM-dd HH:mm'
$branch = git branch --show-current

$novo = "<!-- AUTO: $data | $branch -->"
$conteudo = [System.IO.File]::ReadAllText('CLAUDE.md', [System.Text.Encoding]::UTF8)

if ($conteudo -match '<!-- AUTO:.*-->') {
    $conteudo = [System.Text.RegularExpressions.Regex]::Replace(
        $conteudo, '<!-- AUTO:.*?-->', $novo
    )
} else {
    $conteudo = $conteudo.TrimEnd() + "`n`n$novo`n"
}

[System.IO.File]::WriteAllText('CLAUDE.md', $conteudo, [System.Text.Encoding]::UTF8)
Write-Host "[hook] CLAUDE.md: $novo"
