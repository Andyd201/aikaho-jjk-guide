-- Schéma v2 : l'id vient du CSV (ex. JJK01-SSR-001), car la numérotation
-- recommence à 001 dans chaque rareté.
create table cards (
    id text primary key,
    name text not null,
    set_code text not null,
    number text not null,
    rarity text not null,
    rarity_rank int not null,
    description text,
    image_url text,
    created_at timestamptz not null default now(),

    constraint check_rarity check (
        rarity in ('ACE','CHR','UTR','SE','TQR','SAR','QR','SSR','SR','RRR','R')
    ),
    constraint check_rarity_rank check (rarity_rank between 1 and 11)
);
