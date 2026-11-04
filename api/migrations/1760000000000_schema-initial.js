// Migration 1 : le schéma du Sprint 1 (ancien db/init.sql).
// « if not exists » : sur le Pi, la table existe déjà → rien ne change, la migration est juste notée comme faite.
export const up = (pgm) => {
  pgm.sql(`
    create table if not exists cards (
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
  `);
};

export const down = (pgm) => {
  pgm.sql("drop table if exists cards");
};
