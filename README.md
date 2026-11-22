# Dark Side Coach

Rozšíření doplňuje do detailu lekce v rezervacích Dark Side Movement jméno coache, jeho portrét, pokud je k dispozici, a téma včetně emoji z rozpisu v Notionu.

[Stáhnout ZIP z nejnovějšího vydání](https://github.com/beny/dark-side-coach/releases/latest)

## Ukázka

![Detail lekce Kalistenika s coachem, jeho portrétem a tématem Pistol squat](docs/dark-side-coach.png)

## Chrome na počítači

1. Stáhni ZIP z části **Assets** nejnovějšího vydání a rozbal ho.
2. Otevři `chrome://extensions` a zapni **Režim pro vývojáře**.
3. Klikni na **Načíst rozbalené** a vyber složku se souborem `manifest.json`.
4. Obnov stránku rezervací a otevři detail lekce.

## Dočasná instalace v Safari na Macu

1. V **Safari → Nastavení → Pokročilé** zapni **Zobrazit funkce pro webové vývojáře**.
2. V **Nastavení → Vývojář → Přidat dočasné rozšíření** vyber stažený ZIP.
3. Povol přístup k rezervacím a k rozpisu v Notionu, pokud se Safari zeptá. Pak obnov stránku rezervací.

Safari odebere dočasné rozšíření při ukončení nebo po 24 hodinách.

## Sestavení pro Safari na Macu a iPhonu

Projekt `safari/Dark Side Coach.xcodeproj` obsahuje aplikaci s rozšířením pro macOS a iOS. V Xcode vyber cílové zařízení a použij **Product → Run**. Pro instalaci na iPhone je potřeba aplikaci podepsat v Xcode. Na Macu se lokálně podepsané sestavení povoluje přes **Povolit nepodepsaná rozšíření**.

## Zdroj dat

Při otevření detailu rozšíření načte data přímo z veřejného rozpisu Notionu uvedeného u položky **Rozpis témat**. Lekci vybere podle pobočky, data a času. Načítání probíhá na pozadí bez otevírání karet.

Portréty pocházejí z oficiální stránky týmu Dark Side Movement. [Náš tým](https://www.darksidemovement.cz/nas-tym)
