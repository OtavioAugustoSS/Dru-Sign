"""Extrai ORDEM2.DBF do legado para o gabarito de testes. Uso unico."""
import json, os, struct, sys

ORIGEM = r"C:\legacy-drusign-dados\OSGRAFICA4.5A\DADOS\ORDEM2.DBF"
DESTINO = os.path.join("src", "domain", "precificacao", "__fixtures__", "ordem2-gabarito.json")
ENCODING = "cp1252"

def ler_dbf(caminho):
    with open(caminho, "rb") as f:
        cab = f.read(32)
        n_regs, tam_cab, tam_reg = struct.unpack("<IHH", cab[4:12])
        campos = []
        f.seek(32)
        while True:
            d = f.read(32)
            if len(d) < 32 or d[0] in (0x0D, 0x00):
                break
            nome = d[0:11].split(b"\x00")[0].decode("ascii", "replace").strip()
            campos.append({"nome": nome, "tipo": chr(d[11]), "tam": d[16], "dec": d[17]})
        f.seek(tam_cab)
        for _ in range(n_regs):
            bruto = f.read(tam_reg)
            if len(bruto) < tam_reg:
                break
            if bruto[0:1] == b"*":
                continue
            valores, pos = {}, 1
            for c in campos:
                pedaco = bruto[pos:pos + c["tam"]]
                pos += c["tam"]
                if c["tipo"] in ("C", "M"):
                    valores[c["nome"]] = pedaco.decode(ENCODING, "replace").strip()
                elif c["tipo"] in ("N", "F"):
                    txt = pedaco.decode("ascii", "replace").strip()
                    valores[c["nome"]] = float(txt) if txt else 0.0
                else:
                    valores[c["nome"]] = pedaco.decode(ENCODING, "replace").strip()
            yield valores

def main():
    if not os.path.exists(ORIGEM):
        sys.exit(f"Origem nao encontrada: {ORIGEM}")
    linhas = []
    for v in ler_dbf(ORIGEM):
        linhas.append({
            "os": int(v.get("NUMERO") or 0),
            "descricao": v.get("DESCRICAO", ""),
            "unidadeLegado": v.get("UNIDADE", ""),
            "altura": round(v.get("ALTURA") or 0.0, 4),
            "largura": round(v.get("LARGURA") or 0.0, 4),
            "totmt": round(v.get("TOTMT") or 0.0, 4),
            "valor": round(v.get("VALOR") or 0.0, 2),
            "quantidade": round(v.get("QUANTIA") or 0.0, 4),
            "total": round(v.get("TOTAL") or 0.0, 2),
        })
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8") as f:
        json.dump(linhas, f, ensure_ascii=False, indent=1)
    print(f"{len(linhas)} linhas escritas em {DESTINO}")

if __name__ == "__main__":
    main()
