// Migration 3 : file d'import des photos (page /admin).
// Une ligne par photo déposée : ce que Claude Vision a lu, les corrections, le produit Eyesight.
// Au moment de « Publier », les lignes deviennent des cartes dans la table cards.
export const up = (pgm) => {
  pgm.sql(`
    create table import_items (
        id serial primary key,
        set_code text not null references sets(code) on delete cascade,
        image_file text not null,             -- ex. upload-3f2c….webp dans images/<SET>/
        original_filename text,
        -- pending → processing → done (ou error) : lecture par Claude Vision
        status text not null default 'pending'
            check (status in ('pending', 'processing', 'done', 'error')),
        error text,
        name text,                            -- nom romanisé (ex. Satoru Gojo)
        name_original text,                   -- nom tel qu'imprimé (ex. 五条悟)
        rarity text,
        number text,                          -- 3 chiffres (ex. 012)
        printed_code text,                    -- code imprimé sur la carte (ex. SSR-012)
        confidence text check (confidence in ('high', 'medium', 'low')),
        notes text,
        product_url text,                     -- produit Eyesight choisi
        product_name text,
        product_candidates jsonb not null default '[]',
        validated boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
    );

    create index import_items_set_code_idx on import_items (set_code);
  `);
};

export const down = (pgm) => {
  pgm.sql("drop table import_items");
};
