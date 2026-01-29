# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [0.1.0] - 2026-01-29

### Adicionado
- 🎮 Estrutura inicial do projeto com Vite + TypeScript
- 📦 Grid 8x8 de gemas com 6 tipos diferentes
- 🔄 Sistema de seleção e troca de gemas adjacentes
- ✨ Detecção de combinações horizontais e verticais (3+)
- 📉 Animação de queda com easing (bounce)
- 🔢 Sistema de pontuação (10 pontos por gema)
- 🔁 Efeito cascata (combinações em sequência)
- 📱 Suporte a touch para mobile
- 🎨 Interface estilizada com gradientes e sombras
- 📝 README com instruções
- 📋 CHANGELOG iniciado

### Técnico
- Classe `Board` com toda lógica do match-3
- Tipos TypeScript para Gem, Position, Match
- Renderização via Canvas 2D
- Prevenção de matches iniciais no grid
