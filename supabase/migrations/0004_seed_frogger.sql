-- SPEC frogger/01-frogger-core: añade la fila `frogger` al catálogo.
-- Nota: la SQL del spec usaba color 'lime' (no permitido por el CHECK de
-- games.color: cyan/magenta/yellow/green) y omitía sort_order (NOT NULL).
-- Ajustado a green y sort_order 8 (siguiente tras duelo-pixel) por decisión
-- explícita del usuario durante la implementación.

insert into games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'frogger',
    'FROGGER',
    'Cruza la carretera y el río sin convertirte en papilla.',
    'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
    'ARCADE',
    'cover-frogger',
    'green',
    8
  );
