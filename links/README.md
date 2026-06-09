# Página de links — Carol Nunes · Beauty Artist

Mini landing page boutique que substitui o Linktree. Arquivo único, sem login,
sem build. Abre direto: `links/index.html`.

Estética: editorial, atemporal, feminina — alinhada ao guia de marca
(monograma CN, Cormorant Garamond, DM Sans, paleta café/dourado/creme).

---

## ✏️ Como editar (tudo num lugar só)

Abra `index.html`, ache o bloco **`const CONFIG = {`** no `<script>`.

| O que mudar | Onde |
|-------------|------|
| Nome / kicker / descrição | `CONFIG.name`, `CONFIG.kicker`, `CONFIG.tagline` |
| **Número do WhatsApp** | `CONFIG.whatsapp` — DDI+DDD, só números (ex.: `5511987654321`) |
| Instagram / TikTok | `CONFIG.instagram`, `CONFIG.tiktok` |
| Cidade / atendimento | `CONFIG.location` |
| Enquadramento da foto | `CONFIG.photoPosition` (ex.: `'center 10%'` sobe o rosto) |

## 📸 Foto de perfil — modo de ajuste

Abra a página com **`?edit`** no fim da URL (ex.: `index.html?edit`).
Aparece um editor onde você pode:

- **Enviar uma foto** (testa quantas quiser),
- **arrastar** a foto dentro do quadro para reposicionar,
- dar **zoom**,
- **Salvar** o enquadramento (fica guardado no seu aparelho para você comparar).

> O ajuste salvo vale só no SEU navegador (é para testar). Quando achar a foto
> e o enquadramento ideais, me envie a foto escolhida que eu fixo no site para
> todas as visitantes (vira o `perfil.jpg` definitivo + posição padrão no CONFIG).

Foto padrão atual: **CAROL-634** do seu ensaio (`perfil.jpg`).

## 🅰️ Fontes da marca

- **Cormorant Garamond** (nome/títulos) e **DM Sans** (texto/UI) → já carregam do Google Fonts.
- **Títulos dos botões:** DM Sans em **versais** (maiúsculas espaçadas). Dá para
  testar outras no painel ✎ → "Fonte dos botões"; me peça para fixar se mudar.
- **Eyesome Script** (assinatura no rodapé) é fonte paga e **não** está no Google.
  Para ela aparecer também para as visitantes, coloque o arquivo em
  `links/fonts/eyesome.woff2`. Sem o arquivo, a assinatura cai elegantemente
  no Cormorant itálico (continua bonita).

## 🎨 Paleta (oficial)

`#2C1A0E` ébano · `#4A2E1A` café · `#B8975A` dourado · `#F5EDE3` creme.

## ➕ Adicionar um link novo

No bloco **`const LINKS = [`**, copie um item e cole no fim:

```js
{
  id:'meu-link',          // identificador único (para o analytics)
  variant:'default',      // primary | default | soon
  title:'Título do botão',
  sub:'Descrição curta',  // opcional — omita para botão só com título
  href:'https://...',     // ou  WA()  para abrir o WhatsApp
},
```

Para **lançar o curso**: no item `cursos`, troque `variant:'soon'` → `'default'`,
remova o `badge:'Em breve'` e preencha o `href`.

Os botões de WhatsApp (`WA()`) abrem a conversa **sem mensagem pronta** — a
cliente escreve o que quiser.

## 📊 Analytics (cliques)

- **Local (já funciona):** abra a página com `?stats` no fim da URL
  → painel com a contagem de cliques de cada botão neste aparelho.
- **Relatórios completos:** crie uma conta no Google Analytics, pegue o ID
  `G-XXXXXXX` e cole em `CONFIG.gaId`. Cada clique vira o evento `link_click`.

## 🔍 SEO

Já incluso: `title`, `description`, Open Graph (preview no WhatsApp),
Twitter Card, favicon (monograma CN) e dados estruturados (Google).
Ao definir o domínio, troque as URLs `https://makecarolnunes.com/` no `<head>`.

## 🌐 Domínio sugerido

Registre **`makecarolnunes.com`** e sirva esta página na raiz.
No GitHub Pages: Settings → Pages → Custom domain → `makecarolnunes.com`
(crie um arquivo `CNAME` com o domínio e aponte o DNS conforme o GitHub indicar).
