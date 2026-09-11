#!/usr/bin/env python3
"""Génère les icônes de l'extension : un volant blanc sur fond violet arrondi.

    python3 tools/make-icons.py

Écrit extension/icons/icon-{16,32,48,128}.png. Pas de dépendance : le PNG est
assemblé à la main (zlib + CRC), et le rendu se fait par suréchantillonnage 4x
pour des bords lissés.

Les icônes générées sont versionnées ; ce script sert à les régénérer si le
dessin change.
"""

import math
import pathlib
import struct
import zlib

ACCENT = (147, 32, 121)  # #932079, le violet de la charte BadAsso
BLANC = (255, 255, 255)
SUPER = 4  # facteur de suréchantillonnage

SORTIE = pathlib.Path(__file__).resolve().parent.parent / "extension" / "icons"
TAILLES = (16, 32, 48, 128)


def dans_rectangle_arrondi(x, y, rayon):
    """x, y dans [0, 1]. Rectangle plein coins arrondis."""
    cx = min(max(x, rayon), 1 - rayon)
    cy = min(max(y, rayon), 1 - rayon)
    dx, dy = x - cx, y - cy
    if dx == 0 or dy == 0:
        return True
    return dx * dx + dy * dy <= rayon * rayon


def dans_polygone(x, y, sommets):
    dedans = False
    n = len(sommets)
    for i in range(n):
        x1, y1 = sommets[i]
        x2, y2 = sommets[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                dedans = not dedans
    return dedans


def dans_cercle(x, y, cx, cy, r):
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


# Le volant, en coordonnées normalisées : une jupe trapézoïdale évasée vers le
# haut, et le bouchon en demi-sphère en bas.
JUPE = [(0.19, 0.13), (0.81, 0.13), (0.655, 0.62), (0.345, 0.62)]
BOUCHON = (0.5, 0.665, 0.165)

# Nervures de la jupe, tracées en couleur de fond. Omises en dessous de 32 px,
# où elles ne feraient que brouiller le dessin.
NERVURES = [((0.5, 0.62), (0.5, 0.13)), ((0.42, 0.62), (0.30, 0.13)), ((0.58, 0.62), (0.70, 0.13))]
EPAISSEUR_NERVURE = 0.022


def distance_segment(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    longueur = dx * dx + dy * dy
    if longueur == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / longueur))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def couleur_en(x, y, avec_nervures):
    """Renvoie (r, v, b, a) pour un point normalisé, sans anticrénelage."""
    if not dans_rectangle_arrondi(x, y, 0.22):
        return (0, 0, 0, 0)

    sur_volant = dans_polygone(x, y, JUPE) or dans_cercle(x, y, *BOUCHON)
    if not sur_volant:
        return ACCENT + (255,)

    if avec_nervures and not dans_cercle(x, y, *BOUCHON):
        for a, b in NERVURES:
            if distance_segment(x, y, a, b) < EPAISSEUR_NERVURE / 2:
                return ACCENT + (255,)

    return BLANC + (255,)


def rendre(taille):
    avec_nervures = taille >= 32
    lignes = bytearray()
    for py in range(taille):
        lignes.append(0)  # type de filtre PNG : aucun
        for px in range(taille):
            # Moyenne des SUPER x SUPER sous-échantillons.
            r = v = b = a = 0
            for sy in range(SUPER):
                for sx in range(SUPER):
                    nx = (px + (sx + 0.5) / SUPER) / taille
                    ny = (py + (sy + 0.5) / SUPER) / taille
                    cr, cv, cb, ca = couleur_en(nx, ny, avec_nervures)
                    # Prémultiplication : sans elle, les pixels transparents
                    # (noirs) assombriraient le pourtour des coins arrondis.
                    r += cr * ca
                    v += cv * ca
                    b += cb * ca
                    a += ca
            n = SUPER * SUPER
            if a == 0:
                lignes += bytes((0, 0, 0, 0))
            else:
                lignes += bytes((round(r / a), round(v / a), round(b / a), round(a / n)))
    return bytes(lignes)


def morceau(nom, donnees):
    bloc = nom + donnees
    return struct.pack(">I", len(donnees)) + bloc + struct.pack(">I", zlib.crc32(bloc))


def ecrire_png(chemin, taille, pixels):
    entete = struct.pack(">IIBBBBB", taille, taille, 8, 6, 0, 0, 0)  # 8 bits, RGBA
    chemin.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + morceau(b"IHDR", entete)
        + morceau(b"IDAT", zlib.compress(pixels, 9))
        + morceau(b"IEND", b"")
    )


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    for taille in TAILLES:
        chemin = SORTIE / f"icon-{taille}.png"
        ecrire_png(chemin, taille, rendre(taille))
        print(f"  {chemin.relative_to(SORTIE.parent.parent)}  ({chemin.stat().st_size} o)")


if __name__ == "__main__":
    main()
