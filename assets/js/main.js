/* Entre proches — scripts du site (aucune dépendance) */
(function () {
  "use strict";

  /* Site de démonstration : les formulaires n'envoient rien. Passer à false pour la version en ligne. */
  var DEMO = true;

  /* ------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------ */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        toggle.focus();
      }
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      });
    });
  }

  /* Année du copyright */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------------------------------
     Envoi des formulaires (fetch vers api/envoi.php)
     ------------------------------------------------------------------ */
  function sendForm(form, extra) {
    var status = form.querySelector(".form-status") || form.parentNode.querySelector(".form-status");
    var button = form.querySelector('button[type="submit"]');
    var data = new FormData(form);
    if (extra) Object.keys(extra).forEach(function (k) { data.append(k, extra[k]); });

    if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = "Envoi en cours…"; }

    // MAQUETTE : aucun envoi réel, on simule la réponse du serveur.
    var request = DEMO
      ? new Promise(function (resolve) { setTimeout(resolve, 700); })
      : fetch(form.getAttribute("action"), { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "Erreur"); return j; }); });

    return request
      .then(function () {
        form.hidden = true;
        var ok = form.parentNode.querySelector(".form-status--ok");
        if (ok) { ok.hidden = false; ok.focus(); }
      })
      .catch(function () {
        var err = form.querySelector(".form-status--error");
        if (err) { err.hidden = false; err.focus(); }
      })
      .finally(function () {
        if (button) { button.disabled = false; button.textContent = button.dataset.label; }
      });
  }

  var msgForm = document.getElementById("form-message");
  if (msgForm) {
    msgForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!msgForm.reportValidity()) return;
      sendForm(msgForm);
    });
  }

  /* ------------------------------------------------------------------
     Simulateur de prix (page Contact)
     Règles issues du doc « Page contact – Entre proches VD »
     ------------------------------------------------------------------ */
  var sim = document.getElementById("simulateur-form");
  if (!sim) return;

  var CONFIG = {
    minimum: 1000,                  // € HT minimum par prestation
    vaisselleParPersonne: 3,        // € HT
    verre: 4,                       // € HT par verre de vin ou kir
    formules: {
      collation:    { label: "Petite collation (6 pièces)", prix: 16 },
      cocktail:     { label: "Cocktail (12 pièces)", prix: 25 },
      dejeunatoire: { label: "Cocktail déjeunatoire ou dînatoire (18 pièces)", prix: 29 },
      repas:        { label: "Repas ou buffet", prix: 28 }
    },
    // Frais de déplacement. Paris intramuros (75) : +200 € HT.
    // +100 € HT au-delà de 50 min de Brunoy : APPROXIMATION par département,
    // à remplacer par la liste de communes validée par Stevann.
    paris: { departements: ["75"], frais: 200, label: "Déplacement Paris intramuros" },
    loin:  { departements: ["89", "45"], codesPostaux: [], frais: 100, label: "Déplacement à plus de 50 min de Brunoy" },
    zone:  ["75", "77", "78", "91", "92", "93", "94", "95", "89", "45"]
  };

  var $ = function (sel) { return sim.querySelector(sel); };
  var fields = {
    formule: $("#sim-formule"), convives: $("#sim-convives"), date: $("#sim-date"),
    ville: $("#sim-ville"), cp: $("#sim-cp"), vaisselle: $("#sim-vaisselle"),
    vin: $("#sim-vin"), verres: $("#sim-verres"), vege: $("#sim-vege"), porc: $("#sim-porc"),
    allergies: $("#sim-allergies"), precisions: $("#sim-precisions")
  };
  var verresWrap = document.getElementById("sim-verres-wrap");
  var precisionsWrap = document.getElementById("sim-precisions-wrap");
  var zoneAlert = document.getElementById("sim-zone-alert");
  var linesEl = document.getElementById("sim-lignes");
  var totalEl = document.getElementById("sim-total");
  var openBtn = document.getElementById("sim-open-devis");
  var devisForm = document.getElementById("form-devis");
  var lastEstimate = null;

  function eur(v) { return Math.round(v).toLocaleString("fr-FR") + " € HT"; }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) || n < 0 ? 0 : n; }

  function compute() {
    var f = CONFIG.formules[fields.formule.value] || CONFIG.formules.cocktail;
    var n = int(fields.convives.value);
    var vaisselle = fields.vaisselle.value === "oui";
    var vin = fields.vin.value === "oui";
    var verres = vin ? int(fields.verres.value) : 0;

    var repas = n * f.prix;
    var coutVaisselle = vaisselle ? n * CONFIG.vaisselleParPersonne : 0;
    var coutVin = verres * CONFIG.verre;
    var sousTotal = repas + coutVaisselle + coutVin;
    var complement = n > 0 && sousTotal < CONFIG.minimum ? CONFIG.minimum - sousTotal : 0;

    var cp = (fields.cp.value || "").trim();
    var cpValide = /^\d{5}$/.test(cp);
    var dep = cpValide ? cp.slice(0, 2) : "";
    var horsZone = cpValide && CONFIG.zone.indexOf(dep) === -1;
    var deplacement = null;
    // Les deux frais ne se cumulent pas : Paris est prioritaire.
    if (CONFIG.paris.departements.indexOf(dep) !== -1) deplacement = CONFIG.paris;
    else if (CONFIG.loin.departements.indexOf(dep) !== -1 || CONFIG.loin.codesPostaux.indexOf(cp) !== -1) deplacement = CONFIG.loin;

    var lignes = [{ label: f.label + ", " + n + " personne" + (n > 1 ? "s" : ""), value: eur(repas) }];
    if (vaisselle) lignes.push({ label: "Vaisselle", value: "+ " + eur(coutVaisselle) });
    if (vin) lignes.push({ label: "Vin ou kir, " + verres + " verre" + (verres > 1 ? "s" : ""), value: "+ " + eur(coutVin) });
    if (complement) lignes.push({ label: "Complément au minimum de prestation (1 000 € HT)", value: "+ " + eur(complement) });
    if (deplacement) lignes.push({ label: deplacement.label, value: "+ " + eur(deplacement.frais) });
    if (horsZone) lignes.push({ label: "Déplacement hors zone habituelle", value: "à confirmer" });

    var total = n > 0 ? sousTotal + complement + (deplacement ? deplacement.frais : 0) : 0;

    var besoins = [];
    if (fields.vege.checked) besoins.push("végétarien");
    if (fields.porc.checked) besoins.push("sans porc");
    if (fields.allergies.checked) besoins.push("allergies / intolérances" + (fields.precisions.value ? " : " + fields.precisions.value : ""));

    return { formule: f.label, convives: n, date: fields.date.value, ville: fields.ville.value, cp: cp,
             vaisselle: vaisselle ? "oui" : "non", vin: vin ? verres + " verres" : "non",
             besoins: besoins.join(", ") || "aucun", horsZone: horsZone, lignes: lignes, total: total };
  }

  function render() {
    verresWrap.hidden = fields.vin.value !== "oui";
    precisionsWrap.hidden = !fields.allergies.checked;
    var r = compute();
    lastEstimate = r;
    zoneAlert.hidden = !r.horsZone;
    linesEl.innerHTML = "";
    r.lignes.forEach(function (l) {
      var li = document.createElement("li");
      var a = document.createElement("span"); a.textContent = l.label;
      var dots = document.createElement("span"); dots.className = "estimate__dots"; dots.setAttribute("aria-hidden", "true");
      var b = document.createElement("strong"); b.textContent = l.value;
      li.append(a, dots, b); linesEl.appendChild(li);
    });
    totalEl.textContent = r.total ? eur(r.total) : "—";
  }

  sim.addEventListener("input", render);
  sim.addEventListener("change", render);
  sim.addEventListener("submit", function (e) { e.preventDefault(); });
  render();

  if (openBtn && devisForm) {
    openBtn.addEventListener("click", function () {
      devisForm.hidden = false;
      openBtn.parentNode.hidden = true;
      var first = devisForm.querySelector('input[name="nom"]');
      if (first) first.focus();
    });
    devisForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!devisForm.reportValidity()) return;
      var r = lastEstimate || compute();
      sendForm(devisForm, {
        "estimation_formule": r.formule,
        "estimation_convives": r.convives,
        "estimation_date": r.date,
        "estimation_lieu": (r.ville + " " + r.cp).trim(),
        "estimation_vaisselle": r.vaisselle,
        "estimation_vin": r.vin,
        "estimation_besoins": r.besoins,
        "estimation_hors_zone": r.horsZone ? "oui" : "non",
        "estimation_detail": r.lignes.map(function (l) { return l.label + " : " + l.value; }).join("\n"),
        "estimation_total": r.total ? eur(r.total) : "—"
      });
    });
  }
})();
