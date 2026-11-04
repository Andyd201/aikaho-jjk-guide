// Migration 2 : plusieurs jeux et plusieurs sets, avec des raretés propres à chaque set.
// JJK-01 est créé ici et ses 151 cartes existantes y sont rattachées, sans perte.
const JJK01_RARITIES = ["SE", "ACE", "CHR", "UTR", "TQR", "SAR", "QR", "SSR", "SR", "RRR", "R"];

export const up = (pgm) => {
  pgm.sql(`
    create table games (
        code text primary key,
        name text not null,
        created_at timestamptz not null default now()
    );

    create table sets (
        code text primary key,
        game_code text not null references games(code),
        name text not null,
        release_date date,
        -- Page Eyesight du set (booster box, catégorie…) : lien par défaut des fiches
        product_url text,
        -- draft = en préparation dans /admin, invisible dans le guide
        status text not null default 'draft' check (status in ('draft', 'published')),
        created_at timestamptz not null default now()
    );

    -- Le rang dépend du set : SR peut être n° 9 dans un set et n° 2 dans un autre
    create table rarities (
        set_code text not null references sets(code) on delete cascade,
        code text not null,
        rank int not null check (rank >= 1),
        primary key (set_code, code),
        unique (set_code, rank)
    );

    insert into games (code, name) values ('AIKAHO-JJK', 'Aikaho Jujutsu Kaisen');

    insert into sets (code, game_code, name, product_url, status) values (
        'JJK-01', 'AIKAHO-JJK', 'Aikaho Jujutsu Kaisen JJK-01',
        'https://eyesightcollectibles.com/product/aikaho-jujutsu-kaisen-jjk-01-booster-box-anime-trading-cards/',
        'published'
    );
  `);

  // Ordre de JJK-01, de la plus rare (rang 1) à la plus commune
  pgm.sql(
    `insert into rarities (set_code, code, rank)
     select 'JJK-01', code, rank from unnest(array[${JJK01_RARITIES.map((r) => `'${r}'`).join(",")}]) with ordinality as t(code, rank)`,
  );

  pgm.sql(`
    -- Les raretés et leur rang viennent maintenant de la table rarities
    alter table cards
        drop constraint if exists check_rarity,
        drop constraint if exists check_rarity_rank,
        drop column rarity_rank,
        -- Produit Eyesight de la carte (vente à l'unité) ; sinon on prend celui du set
        add column product_url text,
        add constraint cards_set_fk foreign key (set_code) references sets(code) on delete cascade,
        add constraint cards_rarity_fk foreign key (set_code, rarity) references rarities(set_code, code);

    create index cards_set_code_idx on cards (set_code);
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    alter table cards
        drop constraint cards_rarity_fk,
        drop constraint cards_set_fk,
        drop column product_url,
        add column rarity_rank int;

    update cards c set rarity_rank = r.rank
    from rarities r where r.set_code = c.set_code and r.code = c.rarity;

    alter table cards alter column rarity_rank set not null;
    drop index if exists cards_set_code_idx;
    drop table rarities;
    drop table sets;
    drop table games;
  `);
};
