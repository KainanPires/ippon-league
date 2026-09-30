# Estúdio de cenas animadas (custo zero)
Cenas de "app"/infografia animadas em HTML e gravadas em MP4 1080×1920, 30 fps.
- `engine.js`: motor determinístico. Cada elemento com `data-in="<segundos>"` entra com `data-fx` (up, fade, pop, left, right, slam, drop, strike). Extras: `data-count="de,até"` (contador), `data-pulse`, `data-bob` (Dôdo a respirar), `data-jolt` (tremor), `data-out` (sai). `#flash data-at` dá flashes; partículas douradas e zoom lento do fundo são automáticos.
- `rec.mjs`: lê `meta.json` ({cena: duração}), desenha quadro a quadro com `render(t)` e junta com ffmpeg em `out/<cena>.mp4`.
Cada campanha tem o seu `build.py`, que gera o HTML de cada cena com os tempos de entrada ligados à narração (ex.: `campanhas/como-pontuar/animadas/build.py`).
