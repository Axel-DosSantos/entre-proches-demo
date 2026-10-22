/* Entre proches — back-office de DÉMONSTRATION (interface /admin/) */
(function () {
  "use strict";

  var CMS = window.EP_CMS;
  var D = CMS.defaults;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = CMS.esc;

  /* ---------- Utilitaires ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 2600);
  }
  function data() { return CMS.load(); }
  function enregistrer(d, msg) { if (CMS.save(d)) { toast(msg || "Enregistré"); dashboard(); return true; } return false; }

  /* ---------- Connexion (démo) ---------- */
  function ouvrir() {
    $("#login").hidden = true; $("#app").hidden = false;
    try { sessionStorage.setItem("ep-demo-admin", "1"); } catch (e) {}
    var tab = (location.hash || "#accueil").slice(1);
    onglet($('[data-tab="' + tab + '"]') ? tab : "accueil");
  }
  $("#entrer").addEventListener("click", ouvrir);
  try { if (sessionStorage.getItem("ep-demo-admin")) ouvrir(); } catch (e) {}

  /* ---------- Navigation ---------- */
  function onglet(nom) {
    $$("[data-tab]").forEach(function (b) { b.toggleAttribute("aria-current", b.dataset.tab === nom); if (b.dataset.tab === nom) b.setAttribute("aria-current", "page"); });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== nom; });
    history.replaceState(null, "", "#" + nom);
    if (nom === "accueil") dashboard();
    if (nom === "prix") formPrix();
    if (nom === "pages") chargerPage();
    if (nom === "temoignages") listeTemo();
    if (nom === "articles") listeArticles();
    $("#adm-main").scrollTop = 0; window.scrollTo(0, 0);
  }
  $$("[data-tab]").forEach(function (b) { b.addEventListener("click", function () { onglet(b.dataset.tab); }); });

  $("#reset-all").addEventListener("click", function () {
    if (!confirm("Effacer toutes les modifications de la démo et revenir au site d’origine ?")) return;
    try { localStorage.removeItem(CMS.KEY); } catch (e) {}
    toast("Démo réinitialisée"); onglet("accueil");
  });

  /* ---------- Tableau de bord ---------- */
  function dashboard() {
    var d = data();
    var nbTextes = 0, nbPhotos = 0;
    Object.keys(d.textes || {}).forEach(function (p) { nbTextes += Object.keys(d.textes[p]).length; });
    Object.keys(d.photos || {}).forEach(function (p) { nbPhotos += Object.keys(d.photos[p]).length; });
    var arts = articles();
    var publies = arts.filter(function (a) { return a.publie && !a.supprime; }).length;
    var cartes = [
      ["prix", "€", "Prix & formules", d.prix ? "Prix personnalisés" : "Prix d’origine", "Modifier les tarifs"],
      ["pages", "✎", "Textes & photos", nbTextes + " texte" + (nbTextes > 1 ? "s" : "") + " · " + nbPhotos + " photo" + (nbPhotos > 1 ? "s" : "") + " modifié" + (nbTextes + nbPhotos > 1 ? "s" : ""), "Modifier une page"],
      ["temoignages", "❝", "Témoignages", (d.temoignages || []).length + " en ligne", "Gérer les avis"],
      ["articles", "≡", "Articles", publies + " publié" + (publies > 1 ? "s" : "") + " sur " + arts.filter(function (a) { return !a.supprime; }).length, "Écrire un article"]
    ];
    $("#dash-cards").innerHTML = cartes.map(function (c) {
      return '<button type="button" class="adm-card" data-go="' + c[0] + '"><span class="adm-card__icon" aria-hidden="true">' + c[1] + '</span><strong>' + esc(c[2]) + '</strong><span>' + esc(c[3]) + '</span><em>' + esc(c[4]) + ' →</em></button>';
    }).join("");
    $$("[data-go]").forEach(function (b) { b.addEventListener("click", function () { onglet(b.dataset.go); }); });
    var octets = 0;
    try { octets = (localStorage.getItem(CMS.KEY) || "").length * 2; } catch (e) {}
    $("#storage").textContent = "Espace utilisé par la démo : " + Math.round(octets / 1024) + " Ko (environ 5 000 Ko disponibles dans le navigateur).";
  }

  $("#export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "entre-proches-modifications-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("#import").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (typeof d !== "object" || Array.isArray(d)) throw new Error();
        enregistrer(d, "Modifications importées");
      } catch (e) { toast("Fichier invalide"); }
    };
    r.readAsText(f); this.value = "";
  });

  /* ---------- Prix ---------- */
  var CHAMPS_PRIX = [
    ["tablee", "tablee", "Tablée (repas assis ou buffet)", "€ / personne"],
    ["cocktail", "collation", "Petite collation · 6 pièces", "€ / personne"],
    ["cocktail", "cocktail", "Cocktail · 12 pièces", "€ / personne"],
    ["cocktail", "dejeunatoire", "Déjeunatoire ou dînatoire · 18 pièces", "€ / personne"],
    ["options", "vaisselle", "Vaisselle", "€ / personne"],
    ["options", "verre", "Vin ou kir", "€ / verre"],
    ["options", "minimum", "Minimum par prestation", "€"],
    ["options", "paris", "Déplacement Paris intramuros", "€"],
    ["options", "loin", "Déplacement à plus de 50 min de Brunoy", "€"]
  ];
  function formPrix() {
    var p = Object.assign({}, D.prix, data().prix || {});
    $$("#form-prix [data-group]").forEach(function (g) { g.innerHTML = ""; });
    CHAMPS_PRIX.forEach(function (c) {
      var modifie = data().prix && data().prix[c[1]] != null && Number(data().prix[c[1]]) !== Number(D.prix[c[1]]);
      $('#form-prix [data-group="' + c[0] + '"]').insertAdjacentHTML("beforeend",
        '<label class="adm-field adm-field--prix">' + esc(c[2]) +
        '<span class="adm-input-unit"><input type="number" min="0" step="1" name="' + c[1] + '" value="' + esc(p[c[1]]) + '" required><span>' + esc(c[3]) + "</span></span>" +
        '<small>' + (modifie ? "Prix d’origine : " + esc(D.prix[c[1]]) + " €" : "&nbsp;") + "</small></label>");
    });
  }
  $("#form-prix").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = data(); d.prix = {};
    CHAMPS_PRIX.forEach(function (c) { d.prix[c[1]] = Math.max(0, parseFloat(this.elements[c[1]].value) || 0); }, this);
    if (enregistrer(d, "Prix enregistrés")) formPrix();
  });
  $("#prix-defaut").addEventListener("click", function () {
    var d = data(); delete d.prix;
    if (enregistrer(d, "Prix d’origine rétablis")) formPrix();
  });

  /* ---------- Textes & photos (édition dans la page) ---------- */
  var frame = $("#page-frame");
  function chargerPage() {
    $("#edit-status").textContent = "Chargement…";
    frame.src = "../" + $("#page-select").value + "?cms-edit=1";
  }
  $("#page-select").addEventListener("change", chargerPage);
  frame.addEventListener("load", function () {
    try {
      var doc = frame.contentDocument;
      frame.style.height = Math.max(700, doc.documentElement.scrollHeight) + "px";
    } catch (e) {}
  });
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "cms") return;
    var s = $("#edit-status");
    if (e.data.msg === "saving") { s.textContent = "Enregistrement…"; s.className = "adm-status"; }
    if (e.data.msg === "saved") { s.textContent = "Enregistré ✓"; s.className = "adm-status is-ok"; dashboard(); }
    if (e.data.msg === "ready") { s.textContent = "Cliquez sur un texte ou une photo"; s.className = "adm-status"; }
  });
  $("#page-reset").addEventListener("click", function () {
    var v = $("#page-select").value;
    var key = v === "index.html" ? "/" : v.replace(/index\.html$/, "");
    if (!confirm("Annuler toutes les modifications de textes et de photos de cette page ?")) return;
    var d = data();
    if (d.textes) delete d.textes[key];
    if (d.photos) delete d.photos[key];
    enregistrer(d, "Page remise à l’origine"); chargerPage();
  });

  /* ---------- Témoignages ---------- */
  var temoEdit = -1;
  function listeTemo() {
    var t = data().temoignages || [];
    $("#temo-list").innerHTML = t.length ? t.map(function (q, i) {
      return '<div class="adm-item"><div><p class="adm-quote">« ' + esc(q.texte) + ' »</p><p class="adm-muted">' + esc(q.prenom) + (q.ville ? " · " + esc(q.ville) : "") + '</p></div>' +
        '<div class="adm-item__actions"><button type="button" data-temo-edit="' + i + '">Modifier</button><button type="button" class="adm-danger" data-temo-del="' + i + '">Supprimer</button></div></div>';
    }).join("") : '<p class="adm-empty">Aucun témoignage pour l’instant : l’accueil affiche des emplacements vides.</p>';
    $$("[data-temo-edit]").forEach(function (b) { b.addEventListener("click", function () {
      temoEdit = +b.dataset.temoEdit; var q = t[temoEdit], f = $("#form-temo");
      f.texte.value = q.texte; f.prenom.value = q.prenom; f.ville.value = q.ville || "";
      $("#temo-form-title").textContent = "Modifier le témoignage"; $("#temo-cancel").hidden = false; f.texte.focus();
    }); });
    $$("[data-temo-del]").forEach(function (b) { b.addEventListener("click", function () {
      if (!confirm("Supprimer ce témoignage ?")) return;
      var d = data(); d.temoignages.splice(+b.dataset.temoDel, 1);
      if (!d.temoignages.length) delete d.temoignages;
      enregistrer(d, "Témoignage supprimé"); resetTemo(); listeTemo();
    }); });
  }
  function resetTemo() { temoEdit = -1; $("#form-temo").reset(); $("#temo-form-title").textContent = "Ajouter un témoignage"; $("#temo-cancel").hidden = true; }
  $("#temo-cancel").addEventListener("click", resetTemo);
  $("#form-temo").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = data(); d.temoignages = d.temoignages || [];
    var q = { texte: this.texte.value.trim(), prenom: this.prenom.value.trim(), ville: this.ville.value.trim() };
    if (temoEdit >= 0) d.temoignages[temoEdit] = q; else d.temoignages.push(q);
    if (enregistrer(d, temoEdit >= 0 ? "Témoignage modifié" : "Témoignage ajouté")) { resetTemo(); listeTemo(); }
  });

  /* ---------- Articles ---------- */
  var artEdit = -1, artImage = null;
  function articles() {
    var d = data(), n = Math.max((D.articles || []).length, (d.articles || []).length), out = [];
    for (var i = 0; i < n; i++) out.push(Object.assign({ tag: "", titre: "", resume: "", contenu: "", image: "", publie: false }, (D.articles || [])[i] || {}, (d.articles || [])[i] || {}));
    return out;
  }
  function imgSrc(src) { return !src ? "" : /^data:/.test(src) ? src : "../" + src; }
  function listeArticles() {
    var a = articles();
    $("#art-list").innerHTML = a.map(function (x, i) {
      if (x.supprime) return "";
      return '<div class="adm-item adm-item--art">' + (x.image ? '<img src="' + esc(imgSrc(x.image)) + '" alt="">' : '<span class="adm-noimg"></span>') +
        '<div><p class="adm-tag">' + esc(x.tag) + '</p><strong>' + esc(x.titre || "Sans titre") + '</strong><p class="adm-muted">' + (x.publie ? '<span class="adm-pill adm-pill--ok">Publié</span>' : '<span class="adm-pill">Brouillon · « Article à paraître »</span>') + '</p></div>' +
        '<div class="adm-item__actions"><button type="button" data-art="' + i + '">Modifier</button>' + (x.publie ? '<a href="../conseils-et-ressources/article/?a=' + i + '" target="_blank" rel="noopener">Voir ↗</a>' : "") + "</div></div>";
    }).join("");
    $$("[data-art]").forEach(function (b) { b.addEventListener("click", function () { ouvrirArticle(+b.dataset.art); }); });
  }
  function ouvrirArticle(i) {
    var a = articles(), x = a[i] || { tag: "", titre: "", resume: "", contenu: "", image: "", publie: false };
    artEdit = i; artImage = null;
    var f = $("#form-art");
    f.tag.value = x.tag; f.titre.value = x.titre; f.resume.value = x.resume; f.contenu.value = x.contenu || ""; f.publie.checked = !!x.publie;
    var img = $("#art-img"); img.hidden = !x.image; img.src = imgSrc(x.image);
    $("#art-form-title").textContent = i >= a.length ? "Nouvel article" : "Modifier l’article";
    f.hidden = false; f.scrollIntoView({ behavior: "smooth", block: "start" }); f.titre.focus();
  }
  $("#art-new").addEventListener("click", function () { ouvrirArticle(articles().length); });
  $("#art-cancel").addEventListener("click", function () { $("#form-art").hidden = true; });
  $("#art-file").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    CMS.lireImage(f, 1400, function (url) { artImage = url; var img = $("#art-img"); img.src = url; img.hidden = false; });
    this.value = "";
  });
  $("#form-art").addEventListener("submit", function (e) {
    e.preventDefault();
    var d = data(); d.articles = d.articles || [];
    while (d.articles.length <= artEdit) d.articles.push({});
    var x = Object.assign({}, d.articles[artEdit], {
      tag: this.tag.value.trim(), titre: this.titre.value.trim(), resume: this.resume.value.trim(),
      contenu: this.contenu.value.trim(), publie: this.publie.checked
    });
    if (artImage) x.image = artImage;
    d.articles[artEdit] = x;
    if (enregistrer(d, x.publie ? "Article publié" : "Article enregistré (brouillon)")) { this.hidden = true; listeArticles(); }
  });
  $("#art-delete").addEventListener("click", function () {
    if (artEdit < 0 || !confirm("Supprimer cet article ?")) return;
    var d = data(); d.articles = d.articles || [];
    while (d.articles.length <= artEdit) d.articles.push({});
    d.articles[artEdit] = Object.assign({}, d.articles[artEdit], { supprime: true, publie: false });
    if (enregistrer(d, "Article supprimé")) { $("#form-art").hidden = true; listeArticles(); }
  });
})();
