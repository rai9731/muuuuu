#!/usr/bin/env bash
# Monta o vídeo de apresentação dos animais a partir da gravação original.
#
# Para cada linha de trechos.txt: congela o primeiro quadro do trecho por
# PAUSA segundos com nome e preço por cima, e depois mostra o trecho.
#
# Gera em video-saida/:
#   fotos/<arquivo>.jpg                         quadro congelado (foto de capa)
#   <nome> - apresentacao.mp4                   vídeo completo, som original
#   <nome> - apresentacao com musica.mp4        vídeo completo, música de fundo (leve, < 20 MB)
#   por-animal/<arquivo>.mp4                    pausa + trecho de cada animal, com música
#
# Uso (na raiz do projeto, no Git Bash ou Linux/macOS):
#   bash ferramentas/video/montar_video.sh ["Vacas do Felipe.mp4"] [ferramentas/video/trechos.txt]
#
# Precisa de: ffmpeg/ffprobe e Python 3 com numpy (para a música).
# Variáveis opcionais: FFMPEG, FFPROBE, PYTHON, PAUSA, FONTE_NOME, FONTE_PRECO,
# SAIDA (pasta de saída; padrão video-saida/ na raiz do projeto).
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && (pwd -W 2>/dev/null || pwd))"   # pwd -W: caminho C:/... no Git Bash
SRC="$RAIZ/${1:-Vacas do Felipe.mp4}"
TRECHOS="${2:-$AQUI/trechos.txt}"
FF="${FFMPEG:-ffmpeg}"
FP="${FFPROBE:-ffprobe}"
PY="${PYTHON:-python}"
PAUSA="${PAUSA:-5}"
FONTE_NOME="${FONTE_NOME:-C:/Windows/Fonts/segoeuib.ttf}"
FONTE_PRECO="${FONTE_PRECO:-C:/Windows/Fonts/seguisb.ttf}"

OUT="${SAIDA:-$RAIZ/video-saida}"
TMP="$OUT/.tmp"
BASE="$(basename "$SRC" .mp4)"
mkdir -p "$OUT/fotos" "$OUT/por-animal"
rm -rf "$TMP" && mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT

esc() { printf '%s' "${1//:/\\:}"; }   # escapa ":" para os filtros do ffmpeg
NOME_F="$(esc "$FONTE_NOME")"
PRECO_F="$(esc "$FONTE_PRECO")"

# Partes intermediárias com qualidade alta; a compressão final vem no fim.
ENC=(-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -ac 2)
FINAL=(-c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart)

: > "$TMP/lista.txt"
ARQS=()
i=0
while IFS='|' read -r INI FIM ARQ NOME PRECO; do
  [[ -z "${INI// }" || "$INI" == \#* ]] && continue
  i=$((i+1))
  ARQS+=("$ARQ")

  # 1) quadro exato do início do trecho -> foto de capa
  "$FF" -v error -y -ss "$INI" -i "$SRC" -frames:v 1 -q:v 1 "$OUT/fotos/$ARQ.jpg"

  # 2) pausa: foto congelada com leve aproximação, flash branco e faixa com nome e preço
  printf '%s' "$NOME"  > "$TMP/nome_$i.txt"
  printf '%s' "$PRECO" > "$TMP/preco_$i.txt"
  VF="scale=1696:956,zoompan=z='1+0.06*on/($PAUSA*30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$((PAUSA*30)):s=848x478:fps=30,"
  VF+="fade=in:st=0:d=0.3:color=white,"
  VF+="drawbox=x=0:y=ih-128:w=iw:h=128:color=black@0.6:t=fill:enable='gte(t,0.25)',"
  VF+="drawbox=x=0:y=ih-128:w='min(iw,iw*(t-0.25)/0.5)':h=5:color=0x2E9E4F:t=fill:enable='gte(t,0.25)',"
  VF+="drawtext=fontfile='$NOME_F':textfile='$(esc "$TMP/nome_$i.txt")':fontsize=46:fontcolor=white:x='min(36,-tw+(t-0.35)/0.45*(tw+36))':y=h-110:enable='gte(t,0.35)',"
  VF+="drawtext=fontfile='$PRECO_F':textfile='$(esc "$TMP/preco_$i.txt")':fontsize=38:fontcolor=0xFFD54A:x=36:y=h-54:alpha='min(1,max(0,(t-0.8)/0.4))'"
  "$FF" -v error -y -i "$OUT/fotos/$ARQ.jpg" -f lavfi -t "$PAUSA" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]${VF}[v]" -map "[v]" -map 1:a -t "$PAUSA" "${ENC[@]}" "$TMP/p${i}a.mp4"

  # 3) o trecho em movimento, com o som original
  "$FF" -v error -y -ss "$INI" -i "$SRC" -t "$((FIM-INI))" "${ENC[@]}" "$TMP/p${i}b.mp4"

  printf "file '%s'\nfile '%s'\n" "$TMP/p${i}a.mp4" "$TMP/p${i}b.mp4" >> "$TMP/lista.txt"
  printf "file '%s'\nfile '%s'\n" "$TMP/p${i}a.mp4" "$TMP/p${i}b.mp4" > "$TMP/lista_$i.txt"
  echo "ok: $NOME ($INI-$FIM s)"
done < "$TRECHOS"

# vídeo completo com o som original
"$FF" -v error -y -f concat -safe 0 -i "$TMP/lista.txt" -c copy -movflags +faststart "$OUT/$BASE - apresentacao.mp4"
echo "ok: $BASE - apresentacao.mp4"

# música de fundo do tamanho do vídeo
DUR=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$OUT/$BASE - apresentacao.mp4" | tr -d '\r')
"$PY" -I "$AQUI/musica.py" "$TMP/musica.wav" "$(awk "BEGIN{print int($DUR)+1}")" >/dev/null

# vídeo completo com música (som original removido), comprimido
"$FF" -v error -y -f concat -safe 0 -i "$TMP/lista.txt" -i "$TMP/musica.wav" -map 0:v -map 1:a -shortest "${FINAL[@]}" \
  "$OUT/$BASE - apresentacao com musica.mp4"
echo "ok: $BASE - apresentacao com musica.mp4"

# um vídeo por animal: pausa + trecho, com a música sumindo no final
for n in $(seq 1 "$i"); do
  "$FF" -v error -y -f concat -safe 0 -i "$TMP/lista_$n.txt" -c copy "$TMP/junto_$n.mp4"
  D=$("$FP" -v error -show_entries format=duration -of csv=p=0 "$TMP/junto_$n.mp4" | tr -d '\r')
  "$FF" -v error -y -i "$TMP/junto_$n.mp4" -i "$TMP/musica.wav" -map 0:v -map 1:a \
    -af "afade=t=out:st=$(awk "BEGIN{print $D-1.5}"):d=1.5" -t "$D" "${FINAL[@]}" "$OUT/por-animal/${ARQS[$((n-1))]}.mp4"
  echo "ok: por-animal/${ARQS[$((n-1))]}.mp4"
done
echo "pronto: $OUT"
