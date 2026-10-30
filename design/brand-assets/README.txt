CinéPalette — Kit de marque
===========================
Mis à jour le 14 septembre 2026, généré depuis les deux SVG Pixelmator fournis
(cinepalette-logo-dark-transparent.svg et cinepalette-logo-carre-transparent.svg).

PALETTE (dégradé film, vibrant)
  Violet    #6A2C9E
  Magenta   #B02E8A
  Rose      #E23A6E
  Corail    #FF5A4D
  Orange    #FF8C42
  Ambre     #FFC24B
  Turquoise #3FB8AF
  Bleu      #2E86DE
  Encre     #1A1030  (texte « Ciné » sur fond clair / triangle play)
  Fond noir #12101C  (version sombre)

Le mot-symbole « Palette » parcourt tout le dégradé, du magenta au bleu. Les
perforations de film sont présentes sur toutes les déclinaisons, y compris le
favicon 16 px où elles restent lisibles.

TYPO : Poppins Bold (wordmark)

logo/
  cinepalette-logo.svg / .png             logo horizontal (fond clair)
  cinepalette-logo-dark.svg / .png        logo horizontal (fond sombre)
  cinepalette-logo-dark-transparent.png   logo horizontal (fond transparent)
  cinepalette-icon.svg                    icône seule (coins arrondis)
  cinepalette-icon-square.svg             icône seule (carré, pour stores)
  cinepalette-icon-3000.png               master de l'icône, 3000 px

app-icon/
  appicon-1024.png         principal, coins arrondis (transparent)
  appicon-1024-square.png  carré opaque (App Store / Play Store)
  appicon-512/256/192/180/120  variantes
  appicon-512-maskable.png icône masquable du manifeste (carré redimensionné, 256 couleurs)

favicon/
  favicon.ico              16/32/48/64 groupés
  favicon-16/32/48/64.png
  apple-touch-icon-180.png
  favicon-snippet.html     à coller dans le <head>

NOTE SUR LES SVG
  Les .svg de ce kit ne sont pas vectoriels : ce sont des PNG encapsulés, tels
  qu'exportés par Pixelmator Pro. Ils ne se redimensionnent donc pas mieux que
  les PNG. Attention : les fichiers sortis de Pixelmator embarquent l'image à
  sa résolution maximale — celui de l'icône pesait 13 Mo. Les SVG de ce dossier
  ont été ré-encapsulés à 1024 px pour l'icône et 1960 px pour le logo, parce
  que tout ce qui vit dans public/ part en production. Le master pleine
  résolution reste cinepalette-icon-3000.png.

COMMENT CES FICHIERS ONT ÉTÉ PRODUITS
  Les perforations ne sont pas dans l'image encapsulée : ce sont 16 tracés
  dessinés par-dessus dans le SVG. Il faut donc un vrai moteur de rendu SVG
  (cairosvg ici) ; décoder simplement le base64 les fait disparaître.

  La version « fond clair » est dérivée de la version sombre en ré-encrant les
  pixels blancs et peu saturés du seul mot « Ciné », à droite de l'icône.

  Le carré opaque prolonge chaque colonne de l'icône avec sa couleur de bande,
  échantillonnée entre les perforations hautes et le disque central. Les pixels
  non parfaitement opaques de l'arrondi sont remplacés, pas composités, sinon
  l'arc de l'ancien coin reste visible.

CE QUE L'APPLICATION UTILISE VRAIMENT
  index.html / en.html  favicon.ico, favicon-16, favicon-32,
                        apple-touch-icon-180, cinepalette-logo-dark-transparent.png
                        (en-tête, splash et logo projeté sur l'écran de la salle)
  manifest.json (fr)    appicon-192, appicon-256, appicon-512, appicon-512-maskable
  manifest.en.json (en) mêmes icônes
  Le reste est du matériel de marque, pas des ressources d'exécution.

EMPLACEMENT
  Ce dossier (design/brand-assets/) garde les sources de marque. Seuls les
  fichiers listés ci-dessus sont servis, depuis public/brand-assets/ (mêmes
  sous-dossiers) : tout ce qui vit dans public/ part en production.
