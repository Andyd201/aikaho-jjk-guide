create table cards (
    id serial primary key,
    name text not null,
    set_code text not null,
    number text not null,
    rarity text not null,
    rarity_rank int not null,
    description text,
    image_url text,
    created_at timestamptz not null default now(),

    constraint unique_card unique (set_code, number),
    constraint check_rarity_rank check (rarity_rank between 1 and 17)
);
