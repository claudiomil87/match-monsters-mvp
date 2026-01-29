# 🎮 Match Monsters MVP

MVP de mecânica de combinação (match-3) inspirado no jogo Match Monsters.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Canvas](https://img.shields.io/badge/Canvas-E34F26?style=flat&logo=html5&logoColor=white)

## 🎯 Objetivo

Implementar a mecânica core de um jogo match-3:
- Grid de gemas coloridas
- Troca de peças adjacentes
- Detecção de combinações (3+)
- Animação de queda
- Sistema de pontuação
- Efeito cascata

## 🚀 Demo

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`

## 🎮 Como Jogar

1. Clique em uma gema para selecioná-la
2. Clique em uma gema adjacente (não diagonal) para trocar
3. Se formar uma combinação de 3+ gemas iguais, elas desaparecem
4. Novas gemas caem para preencher os espaços
5. Combinações em cascata dão mais pontos!

## 🔮 Tipos de Gemas

| Emoji | Tipo | Cor |
|-------|------|-----|
| 🔥 | Fogo | Vermelho |
| 💧 | Água | Azul |
| 🌿 | Planta | Verde |
| ⚡ | Elétrico | Amarelo |
| 🔮 | Psíquico | Roxo |
| 🍒 | Dark | Rosa |

## 🛠️ Tecnologias

- **Vite** - Build tool
- **TypeScript** - Tipagem estática
- **Canvas 2D** - Renderização
- **CSS3** - Estilização

## 📁 Estrutura

```
src/
├── main.ts      # Entry point e game loop
├── Board.ts     # Lógica do tabuleiro e match-3
├── types.ts     # Tipos TypeScript
└── style.css    # Estilos
```

## 🔄 Roadmap

- [x] Grid de gemas
- [x] Seleção e troca
- [x] Detecção de matches
- [x] Animação de queda
- [x] Pontuação
- [x] Efeito cascata
- [ ] Drag & drop (arrastar)
- [ ] Gemas especiais (bomba, linha)
- [ ] Efeitos sonoros
- [ ] Partículas de explosão

## 📝 Changelog

Veja [CHANGELOG.md](./CHANGELOG.md)

## 👤 Autor

**Cláudio Milfont** 🤖
- GitHub: [@claudiomil87](https://github.com/claudiomil87)

---

*Projeto criado como MVP para estudo de mecânicas match-3*
