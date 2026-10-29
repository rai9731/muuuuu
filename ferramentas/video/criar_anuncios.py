"""Cria os anúncios do vídeo "Vacas do Felipe" pela API do site (ambiente local),
na conta de teste do vendedor, com a foto de capa e o vídeo curto de cada animal,
e aprova cada anúncio com a conta de admin de demonstração.

Uso (com o site rodando e os dados de demonstração carregados):
    python ferramentas/video/criar_anuncios.py [http://localhost:8085]

Precisa de: Python 3 com requests. Rodar duas vezes cria anúncios repetidos.
"""
import pathlib
import sys

import requests

API = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8085").rstrip("/") + "/api"
SAIDA = pathlib.Path(__file__).resolve().parents[2] / "video-saida"
SENHA = "123456"
LOCAL = {"city": "São José dos Campos", "state": "SP"}
DESC = "Animal criado na roça em São José dos Campos (SP). Veja o vídeo de apresentação."

ANUNCIOS = [
    dict(arq="01-flaco-lopez", title="Flaco Lopez — vaca mestiça", raca="Mestiço", sex="femea",
         age_months=36, weight_kg=180, purpose="reproducao", price=4000, description=DESC),
    dict(arq="02-marlon-freitas", title="Marlon Freitas — touro Girolando", raca="Girolando", sex="macho",
         age_months=48, weight_kg=221, purpose="reproducao", price=7000, description=DESC),
    dict(arq="03-vitor-roque", title="Vitor Roque — vaca mestiça", raca="Mestiço", sex="femea",
         age_months=18, weight_kg=155, purpose="leite", price=5000, description=DESC),
    dict(arq="04-arias-e-sosa", title="Arias — vaca mestiça (casal Arias e Sosa)", raca="Mestiço", sex="femea",
         age_months=26, weight_kg=145, purpose="reproducao", price=3500,
         description=DESC + " Faz dupla com a Sosa, anunciada separadamente pelo mesmo valor."),
    dict(arq="04-arias-e-sosa", title="Sosa — vaca mestiça (casal Arias e Sosa)", raca="Mestiço", sex="femea",
         age_months=22, weight_kg=139, purpose="reproducao", price=3500,
         description=DESC + " Faz dupla com a Arias, anunciada separadamente pelo mesmo valor."),
    dict(arq="05-gustavo-gomez", title="Gustavo Gomez — vaca mestiça", raca="Mestiço", sex="femea",
         age_months=38, weight_kg=160, purpose="corte", price=3000, description=DESC),
    dict(arq="06-bando-de-loucos", title="Bando de Loucos — lote de 8 bezerros mestiços", raca="Mestiço",
         sex="macho", age_months=9, weight_kg=100, purpose="reproducao", price=16000,
         description=DESC + " Lote com 8 bezerros mestiços de 6 a 12 meses, cerca de 100 kg cada. "
         "R$ 2.000 por cabeça (R$ 16.000 o lote)."),
]


def login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": SENHA},
                      headers={"Accept": "application/json"}, timeout=60)
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['token']}", "Accept": "application/json"}


racas = {b["name"]: b["id"] for b in requests.get(f"{API}/breeds", timeout=60).json()["data"]}
vendedor = login("vendedor@boinarede.com.br")
admin = login("admin@admin.com")

for a in ANUNCIOS:
    a = dict(a)
    arq, raca = a.pop("arq"), a.pop("raca")
    if raca not in racas:
        sys.exit(f"Raça '{raca}' não cadastrada. Rode os seeders (php artisan db:seed).")
    dados = {k: str(v) for k, v in {**a, **LOCAL, "breed_id": racas[raca]}.items()}
    dados.update(vaccinated="0", is_pregnant="0")
    with open(SAIDA / "fotos" / f"{arq}.jpg", "rb") as foto, \
         open(SAIDA / "por-animal" / f"{arq}.mp4", "rb") as video:
        r = requests.post(f"{API}/my/cows", headers=vendedor, data=dados, timeout=300, files=[
            ("photos[]", (f"{arq}.jpg", foto, "image/jpeg")),
            ("video", (f"{arq}.mp4", video, "video/mp4")),
        ])
    if r.status_code != 201:
        print("ERRO", a["title"], r.status_code, r.text[:500])
        continue
    cow = r.json()["data"]
    requests.post(f"{API}/admin/cows/{cow['id']}/approve", headers=admin, timeout=60).raise_for_status()
    print(f"ok #{cow['id']} {a['title']}")
