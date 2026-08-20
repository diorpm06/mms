# -*- coding: utf-8 -*-
"""Ism-familiyani bir xil ko'rinishga keltirish.

Registratsiyada admin shoshib "abdullayev", "ABDULLAYEV" yoki "aBduLLayev"
deb yozib yuborishi mumkin. Baza ichida bir xil odam turli ko'rinishda
saqlanib qolmasligi va chekda/hisobotda chiroyli chiqishi uchun har bir
so'zning birinchi harfi bosh, qolgani kichik qilinadi.

Python'ning `.title()` metodi bu yerda yaramaydi, chunki u apostrofdan
keyingi harfni ham bosh harfga aylantiradi:
    "g'anijon".title()  ->  "G'Anijon"   (noto'g'ri)
    ism_tuzat("g'anijon") -> "G'anijon"  (to'g'ri)
"""

# O'zbek tilida ishlatiladigan barcha apostrof ko'rinishlari.
# Bular so'zni bo'lmaydi: O'ktam, G'anijon, Nu'mon.
APOSTROFLAR = "'’‘ʻʼ`´"

# Bular yangi so'z boshlanganini bildiradi: Abdulla-Aziz
AJRATGICHLAR = " -–—/."


def ism_tuzat(matn: str | None) -> str | None:
    """ "aBduLLayev" -> "Abdullayev",  "g'ANIJON" -> "G'anijon".

    None yoki bo'sh satr bo'lsa o'zgartirmasdan qaytaradi.
    Ortiqcha bo'shliqlar ham tozalanadi.
    """
    if not matn:
        return matn

    tozalangan = " ".join(str(matn).split())
    if not tozalangan:
        return tozalangan

    natija = []
    yangi_soz = True
    for ch in tozalangan:
        if ch in AJRATGICHLAR:
            natija.append(ch)
            yangi_soz = True
        elif ch in APOSTROFLAR:
            # Apostrof so'zni bo'lmaydi — keyingi harf kichik qoladi
            natija.append(ch)
        elif yangi_soz:
            natija.append(ch.upper())
            yangi_soz = False
        else:
            natija.append(ch.lower())
    return "".join(natija)
