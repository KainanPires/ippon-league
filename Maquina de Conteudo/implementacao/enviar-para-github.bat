@echo off
cd /d "%~dp0..\.."
echo A enviar a Maquina de Conteudo para o GitHub...
git fetch "Maquina de Conteudo/implementacao/maquina-conteudo.bundle" marketing/maquina-conteudo:marketing/maquina-conteudo
git push origin marketing/maquina-conteudo
echo.
echo Pronto. Se viu "marketing/maquina-conteudo -> marketing/maquina-conteudo", deu certo.
pause
