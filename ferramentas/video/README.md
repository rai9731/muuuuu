# Vídeo de apresentação dos animais

Ferramentas usadas para transformar a gravação `Vacas do Felipe.mp4` no vídeo de
apresentação e nos anúncios de teste. Os arquivos gerados estão em `video-saida/`.

| Arquivo | O que faz |
|---|---|
| `trechos.txt` | Lista de trechos: início, fim, nome do arquivo, nome e preço exibidos. |
| `montar_video.sh` | Corta os trechos, congela o primeiro quadro de cada um por 5 s com nome e preço, gera as fotos de capa, o vídeo completo (com som original e com música) e um vídeo curto por animal. |
| `musica.py` | Compõe a música de fundo instrumental (violão, baixo, chocalho e assobio) em WAV. Feita só para teste. |
| `criar_anuncios.py` | Cria os anúncios na conta de teste do vendedor pela API local, com foto e vídeo, e aprova cada um com a conta de admin. |

## Como usar

Pré-requisitos: [FFmpeg](https://ffmpeg.org) (no Windows: `winget install Gyan.FFmpeg`)
e Python 3 com `numpy` e `requests`.

```bash
# 1. gerar fotos e vídeos em video-saida/ (na raiz do projeto, no Git Bash)
bash ferramentas/video/montar_video.sh "Vacas do Felipe.mp4" ferramentas/video/trechos.txt

# 2. com o site rodando (make up) e os seeders aplicados, criar os anúncios
python ferramentas/video/criar_anuncios.py http://localhost:8085
```

Para outro vídeo, copie `trechos.txt`, ajuste os tempos, nomes e preços e passe os
dois arquivos para o `montar_video.sh`. As fontes padrão são do Windows (Segoe UI);
em outro sistema, defina `FONTE_NOME` e `FONTE_PRECO` com o caminho de um `.ttf`.

## Limites

- O site aceita vídeos `.mp4` de até 20 MB e um vídeo por anúncio; por isso cada
  anúncio recebe só o trecho do seu animal.
- `criar_anuncios.py` não verifica se os anúncios já existem: rodar duas vezes duplica.
- Os dados de raça, sexo e lote dos anúncios seguem o que foi informado pelo dono;
  o sexo do lote "Bando de Loucos" foi marcado como macho por falta da informação.
