# scripts/update-claude.ps1
# Atualiza o bloco de metadados no CLAUDE.md antes do push.
# Chamado automaticamente pelo hook .git/hooks/pre-push

$data   = Get-Date -Format 'yyyy-MM-dd HH:mm'
$branch = git branch --show-current
$commit = git log -1 --pretty=format:'%s'

$novo = "<!-- AUTO: $data | $branch | $commit -->"
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
