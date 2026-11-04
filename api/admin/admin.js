// Interface de /admin : JavaScript sans framework ni build.
// Tout le texte venant de l'API passe par textContent (jamais innerHTML) : pas d'injection possible.

const app = document.getElementById("app");

// ---------- Outils ----------

async function api(path, options = {}) {
  const res = await fetch(`/admin/api${path}`, {
    ...options,
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    body: options.body instanceof FormData ? options.body : options.body && JSON.stringify(options.body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.problems = data.problems;
    throw err;
  }
  return data;
}

// h("button", { class: "secondary", onclick }, "Texte") → élément DOM
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (key in el && key !== "list") el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}

// Désactive le bouton pendant l'action, affiche l'erreur s'il y en a une
async function busy(button, action) {
  button.disabled = true;
  try {
    return await action();
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
}

const STATUS_LABEL = { pending: "en attente", processing: "lecture…", done: "lue", error: "erreur" };
const CONFIDENCE_LABEL = { high: "sûr", medium: "à vérifier", low: "douteux" };

// ---------- Liste des sets ----------

async function renderHome() {
  const [sets, games] = await Promise.all([api("/sets"), api("/games")]);

  const gameSelect = h(
    "select",
    { name: "game_code", required: true },
    games.map((g) => h("option", { value: g.code }, `${g.name} (${g.code})`)),
    h("option", { value: "__new" }, "Nouveau jeu…"),
  );
  const newGame = h(
    "div",
    { class: "row", hidden: games.length > 0 },
    h("label", {}, "Code du jeu", h("input", { name: "new_game_code", placeholder: "ex. KAYOU-NARUTO" })),
    h("label", {}, "Nom du jeu", h("input", { name: "new_game_name", placeholder: "ex. Naruto Kayou" })),
  );
  if (!games.length) gameSelect.value = "__new";
  gameSelect.addEventListener("change", () => (newGame.hidden = gameSelect.value !== "__new"));

  const form = h(
    "form",
    {
      onsubmit: async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const isNew = data.game_code === "__new";
        await busy(form.querySelector("button"), async () => {
          const set = await api("/sets", {
            method: "POST",
            body: {
              code: data.code,
              name: data.name,
              release_date: data.release_date || null,
              product_url: data.product_url || null,
              game_code: isNew ? data.new_game_code : data.game_code,
              game_name: isNew ? data.new_game_name : undefined,
            },
          });
          location.hash = `#/sets/${encodeURIComponent(set.code)}`;
        });
      },
    },
    h("div", { class: "row" }, h("label", {}, "Jeu", gameSelect)),
    newGame,
    h(
      "div",
      { class: "row" },
      h("label", {}, "Code du set", h("input", { name: "code", required: true, placeholder: "ex. JJK-02" })),
      h("label", {}, "Nom du set", h("input", { name: "name", required: true, placeholder: "ex. Aikaho Jujutsu Kaisen JJK-02" })),
      h("label", {}, "Date de sortie", h("input", { name: "release_date", type: "date" })),
      h("label", {}, "Page Eyesight du set", h("input", { name: "product_url", type: "url", placeholder: "https://eyesightcollectibles.com/…" })),
      h("button", { type: "submit" }, "Créer le set"),
    ),
  );

  app.replaceChildren(
    h("h1", {}, "Sets"),
    h(
      "section",
      { class: "panel table-wrap" },
      sets.length
        ? h(
            "table",
            {},
            h("thead", {}, h("tr", {}, ["Set", "Jeu", "Statut", "Photos", "Validées", "Cartes en ligne"].map((t) => h("th", {}, t)))),
            h(
              "tbody",
              {},
              sets.map((s) =>
                h(
                  "tr",
                  {},
                  h("td", {}, h("a", { href: `#/sets/${encodeURIComponent(s.code)}` }, `${s.code} · ${s.name}`)),
                  h("td", {}, s.game_name),
                  h("td", {}, h("span", { class: `badge ${s.status}` }, s.status === "published" ? "publié" : "brouillon")),
                  h("td", {}, s.item_count),
                  h("td", {}, s.validated_count),
                  h("td", {}, s.card_count),
                ),
              ),
            ),
          )
        : h("p", { class: "muted" }, "Aucun set pour l'instant."),
    ),
    h("section", { class: "panel" }, h("h2", {}, "Nouveau set"), form),
  );
}

// ---------- Un set ----------

let pollTimer;

// Pas de rafraîchissement pendant que tu tapes dans un champ : on réessaie 3 s plus tard
function pollRefresh() {
  const active = document.activeElement;
  if (active && app.contains(active) && ["INPUT", "SELECT"].includes(active.tagName)) {
    pollTimer = setTimeout(pollRefresh, 3000);
    return;
  }
  route();
}

async function renderSet(code) {
  const set = await api(`/sets/${encodeURIComponent(code)}`);
  const items = set.items;
  const counts = { pending: 0, processing: 0, done: 0, error: 0 };
  for (const item of items) counts[item.status]++;
  const reading = counts.pending + counts.processing;

  // Rafraîchit tout seul tant que Claude lit des photos
  clearTimeout(pollTimer);
  if (reading) pollTimer = setTimeout(pollRefresh, 3000);

  const onlyToCheck = sessionStorage.getItem("onlyToCheck") === "1";
  const visible = onlyToCheck ? items.filter((i) => !i.validated) : items;

  app.replaceChildren(
    h("p", {}, h("a", { href: "#/" }, "← Tous les sets")),
    h("h1", {}, `${set.code} · ${set.name}`),
    h(
      "p",
      { class: "muted" },
      `${set.game_name} · `,
      h("span", { class: `badge ${set.status}` }, set.status === "published" ? "publié" : "brouillon"),
      ` · ${items.length} photo(s), ${items.filter((i) => i.validated).length} validée(s)`,
    ),
    infoPanel(set),
    uploadPanel(set, counts),
    raritiesPanel(set),
    productsPanel(set),
    cardsPanel(set, visible, onlyToCheck),
    publishPanel(set),
  );
}

function infoPanel(set) {
  const form = h(
    "form",
    {
      class: "row",
      onsubmit: async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        await busy(form.querySelector("button"), async () => {
          await api(`/sets/${encodeURIComponent(set.code)}`, { method: "PATCH", body: data });
          toast("Set enregistré");
        });
      },
    },
    h("label", {}, "Nom", h("input", { name: "name", value: set.name, required: true })),
    h("label", {}, "Date de sortie", h("input", { name: "release_date", type: "date", value: set.release_date?.slice(0, 10) ?? "" })),
    h("label", {}, "Page Eyesight du set (lien par défaut des cartes)", h("input", { name: "product_url", type: "url", value: set.product_url ?? "", class: "url" })),
    h("button", { type: "submit", class: "secondary" }, "Enregistrer"),
  );
  return h("section", { class: "panel" }, h("h2", {}, "1. Infos du set"), form);
}

function uploadPanel(set, counts) {
  const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
  const status = h("p", { class: "muted" });

  async function send(files) {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    // Par paquets de 10 : Cloudflare refuse les envois de plus de 100 Mo
    for (let i = 0; i < images.length; i += 10) {
      status.textContent = `Envoi ${Math.min(i + 10, images.length)} / ${images.length}…`;
      const body = new FormData();
      for (const file of images.slice(i, i + 10)) body.append("photos", file);
      try {
        const result = await api(`/sets/${encodeURIComponent(set.code)}/photos`, { method: "POST", body });
        if (result.failed.length) toast(`${result.failed.length} photo(s) refusée(s) : ${result.failed[0].error}`);
      } catch (err) {
        toast(err.message);
        break;
      }
    }
    route();
  }

  const drop = h(
    "div",
    {
      class: "drop",
      onclick: () => input.click(),
      ondragover: (e) => {
        e.preventDefault();
        drop.classList.add("over");
      },
      ondragleave: () => drop.classList.remove("over"),
      ondrop: (e) => {
        e.preventDefault();
        drop.classList.remove("over");
        send(e.dataTransfer.files);
      },
    },
    "Glisse les photos des cartes ici (ou clique pour choisir). Une carte par photo.",
  );
  input.addEventListener("change", () => send(input.files));

  const reading = counts.pending + counts.processing;
  status.textContent = reading
    ? `Claude lit les cartes : ${counts.done + counts.error} / ${counts.done + counts.error + reading}…`
    : counts.error
      ? `${counts.error} photo(s) en erreur : utilise « Relancer » dans le tableau.`
      : "";

  return h("section", { class: "panel" }, h("h2", {}, "2. Photos"), drop, input, status);
}

function raritiesPanel(set) {
  const input = h("input", {
    value: set.rarities.map((r) => r.code).join(", "),
    placeholder: "ex. SE, UR, SSR, SR, R",
    style: "min-width: 320px",
  });
  // Proposition : la rareté qui a le moins de cartes est probablement la plus rare
  const suggest = () => {
    const counts = new Map();
    for (const item of set.items) if (item.rarity) counts.set(item.rarity, (counts.get(item.rarity) ?? 0) + 1);
    input.value = [...counts].sort((a, b) => a[1] - b[1]).map(([code]) => code).join(", ");
    toast("Proposition selon le nombre de cartes : vérifie l'ordre avant d'enregistrer");
  };
  const save = h("button", {
    class: "secondary",
    onclick: () =>
      busy(save, async () => {
        const order = input.value.split(",").map((s) => s.trim()).filter(Boolean);
        await api(`/sets/${encodeURIComponent(set.code)}/rarities`, { method: "PUT", body: { order } });
        toast("Ordre des raretés enregistré");
        route();
      }),
  }, "Enregistrer");

  return h(
    "section",
    { class: "panel" },
    h("h2", {}, "3. Ordre des raretés (de la plus rare à la plus commune)"),
    h("div", { class: "row" }, input, h("button", { class: "secondary", onclick: suggest }, "Proposer à partir des photos"), save),
  );
}

function productsPanel(set) {
  const result = h("p", { class: "muted" });
  const button = h("button", {
    class: "secondary",
    onclick: () =>
      busy(button, async () => {
        const s = await api(`/sets/${encodeURIComponent(set.code)}/products`, { method: "POST" });
        result.textContent = `${s.matched} trouvé(s) automatiquement, ${s.ambiguous} à choisir, ${s.none} sans produit, ${s.kept} déjà choisi(s).`;
        if (set.items.length) route();
      }),
  }, "Chercher les produits Eyesight");
  return h(
    "section",
    { class: "panel" },
    h("h2", {}, "4. Produits Eyesight"),
    h("p", { class: "muted" }, "Cherche chaque code (ex. SSR-012) dans la boutique. Sans produit, la fiche mène à la page du set."),
    button,
    result,
  );
}

function cardsPanel(set, items, onlyToCheck) {
  const filter = h("input", {
    type: "checkbox",
    checked: onlyToCheck,
    onchange: () => {
      sessionStorage.setItem("onlyToCheck", filter.checked ? "1" : "0");
      route();
    },
  });
  const validateHigh = h("button", {
    class: "secondary",
    onclick: () =>
      busy(validateHigh, async () => {
        const targets = set.items.filter((i) => i.status === "done" && i.confidence === "high" && !i.validated);
        for (const item of targets) await api(`/items/${item.id}`, { method: "PATCH", body: { validated: true } });
        toast(`${targets.length} carte(s) validée(s)`);
        route();
      }),
  }, "Valider toutes les cartes « sûr »");

  return h(
    "section",
    { class: "panel" },
    h("h2", {}, "5. Vérifier les cartes"),
    h("div", { class: "row" }, h("label", { style: "flex-direction: row; align-items: center" }, filter, "Seulement celles pas encore validées"), validateHigh),
    h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        {},
        h("thead", {}, h("tr", {}, ["Photo", "Nom", "Rareté", "N°", "Lecture", "Produit Eyesight", "Validée", ""].map((t) => h("th", {}, t)))),
        h("tbody", {}, items.map((item) => itemRow(set, item))),
      ),
    ),
  );
}

function itemRow(set, item) {
  const save = async (body) => {
    try {
      Object.assign(item, await api(`/items/${item.id}`, { method: "PATCH", body }));
    } catch (err) {
      toast(err.message);
    }
  };
  const field = (key, cls, placeholder) =>
    h("input", { class: cls, value: item[key] ?? "", placeholder, onchange: (e) => save({ [key]: e.target.value }) });

  const src = `/images/${encodeURIComponent(set.code)}/${encodeURIComponent(item.image_file)}`;
  const candidates = item.product_candidates ?? [];
  const productUrl = h("input", {
    class: "url",
    type: "url",
    value: item.product_url ?? "",
    placeholder: "lien du produit (optionnel)",
    onchange: (e) => save({ product_url: e.target.value, product_name: null }),
  });
  const productSelect = candidates.length
    ? h(
        "select",
        {
          onchange: (e) => {
            const chosen = candidates.find((c) => c.url === e.target.value);
            productUrl.value = chosen?.url ?? "";
            save({ product_url: chosen?.url ?? "", product_name: chosen?.name ?? null });
          },
        },
        h("option", { value: "" }, `— ${candidates.length} produit(s) trouvé(s) —`),
        candidates.map((c) => h("option", { value: c.url, selected: c.url === item.product_url }, c.name)),
      )
    : null;

  const reading = ["pending", "processing"].includes(item.status);
  return h(
    "tr",
    { class: item.validated ? "validated" : item.confidence !== "high" ? "needs-check" : "" },
    h("td", {}, h("img", { class: "thumb", src, alt: item.name ?? "", loading: "lazy", onclick: () => zoom(src) })),
    h("td", {}, field("name", "name", "Nom"), h("div", { class: "muted" }, item.name_original ?? "")),
    h("td", {}, field("rarity", "small", "SSR")),
    h("td", {}, field("number", "small", "001")),
    h(
      "td",
      {},
      h("span", { class: `badge ${item.status}` }, STATUS_LABEL[item.status]),
      " ",
      item.confidence && h("span", { class: `badge ${item.confidence}`, title: item.notes ?? "" }, CONFIDENCE_LABEL[item.confidence]),
      item.printed_code && h("div", { class: "muted" }, `Imprimé : ${item.printed_code}`),
      item.notes && h("div", { class: "muted" }, item.notes),
      item.error && h("div", { class: "problems" }, item.error),
    ),
    h("td", {}, productSelect, productUrl),
    h("td", {}, h("input", { type: "checkbox", checked: item.validated, disabled: reading, onchange: (e) => save({ validated: e.target.checked }).then(route) })),
    h(
      "td",
      {},
      h("button", { class: "secondary", disabled: reading, onclick: (e) => busy(e.target, async () => { await api(`/items/${item.id}/retry`, { method: "POST" }); route(); }) }, "Relancer"),
      " ",
      h("button", {
        class: "danger",
        onclick: (e) => {
          if (!confirm("Supprimer cette photo ?")) return;
          busy(e.target, async () => {
            await api(`/items/${item.id}`, { method: "DELETE" });
            route();
          });
        },
      }, "Supprimer"),
    ),
  );
}

function publishPanel(set) {
  const problems = h("ul", { class: "problems" });
  const publish = h("button", {
    onclick: () =>
      busy(publish, async () => {
        problems.replaceChildren();
        try {
          const r = await api(`/sets/${encodeURIComponent(set.code)}/publish`, { method: "POST" });
          toast(`${r.published} cartes en ligne${r.frontRebuild ? " · sitemap en reconstruction sur Render" : ""}`);
          route();
        } catch (err) {
          problems.replaceChildren(...(err.problems ?? [err.message]).slice(0, 30).map((p) => h("li", {}, p)));
        }
      }),
  }, set.status === "published" ? "Republier (mettre à jour le guide)" : "Publier le set");
  const unpublish =
    set.status === "published" &&
    h("button", {
      class: "danger",
      onclick: () => {
        if (!confirm(`Retirer ${set.code} du guide ?`)) return;
        busy(unpublish, async () => {
          await api(`/sets/${encodeURIComponent(set.code)}/unpublish`, { method: "POST" });
          route();
        });
      },
    }, "Retirer du guide");

  return h(
    "section",
    { class: "panel" },
    h("h2", {}, "6. Publier"),
    h("p", { class: "muted" }, "Toutes les photos doivent être lues et validées, et chaque rareté doit être dans l'ordre des raretés."),
    h("div", { class: "row" }, publish, unpublish),
    problems,
  );
}

function zoom(src) {
  const dialog = h("dialog", { onclick: () => dialog.close(), onclose: () => dialog.remove() }, h("img", { src, alt: "" }));
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- Navigation (#/ et #/sets/CODE) ----------

async function route() {
  const match = location.hash.match(/^#\/sets\/(.+)$/);
  try {
    if (match) await renderSet(decodeURIComponent(match[1]));
    else await renderHome();
  } catch (err) {
    clearTimeout(pollTimer);
    app.replaceChildren(h("p", { class: "problems" }, err.message), h("p", {}, h("a", { href: "#/" }, "← Tous les sets")));
  }
}

window.addEventListener("hashchange", route);
api("/me")
  .then((me) => (document.getElementById("who").textContent = me.email ?? ""))
  .catch(() => {});
route();
