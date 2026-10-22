/* Entre proches — back-office de DÉMONSTRATION
 * Applique sur le site les modifications faites dans /admin/.
 * Tout est stocké dans le navigateur (localStorage) : rien n'est publié en ligne.
 */
(function () {
  "use strict";

  var KEY = "ep-demo-cms";
  var SEL = "h1,h2,h3,h4,p,li,blockquote,figcaption,dt,dd,summary,.btn";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { alert("Espace de stockage du navigateur plein : supprimez une photo ou réinitialisez la démo."); return false; }
  }
  function clean(html) {
    var t = document.createElement("template");
    t.innerHTML = html;
    t.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach(function (n) { n.remove(); });
    t.content.querySelectorAll("*").forEach(function (n) {
      [].slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || a.name === "contenteditable" || a.name === "data-cms-i" ||
            (a.name === "href" && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString("fr-FR"); }
  function lireImage(file, max, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  // Racine relative du site (« », « ../ », « ../../ ») et clé de la page courante
  var me = document.querySelector('script[src*="demo-cms.js"]');
  var ROOT = me ? me.getAttribute("src").replace(/assets\/js\/demo-cms\.js.*$/, "") : "";
  var depth = (ROOT.match(/\.\.\//g) || []).length;
  var segs = location.pathname.split("/").filter(function (s) { return s && s !== "index.html"; });
  var PAGE = depth ? segs.slice(-depth).join("/") + "/" : "/";

  var data = load();
  var defaults = window.EP_CMS_DEFAULTS || { prix: {}, articles: [] };
  var prix = Object.assign({}, defaults.prix, data.prix || {});
  window.EP_CMS_PRICES = prix; // lu par main.js (simulateur)
  window.EP_CMS = { KEY: KEY, load: load, save: save, clean: clean, esc: esc, lireImage: lireImage, defaults: defaults };

  var params = new URLSearchParams(location.search);
  var EDIT = params.has("cms-edit") && window.parent !== window;

  function editables() {
    var main = document.querySelector("main");
    if (!main) return [];
    return [].filter.call(main.querySelectorAll(SEL), function (el) {
      return !el.querySelector(SEL) && !el.querySelector("[data-price],input,select,textarea") &&
             !el.closest("form,[data-cms],.article-card,.estimate,#cms-article,.form-status,.photo-credit,[hidden]");
    });
  }
  function images() {
    var main = document.querySelector("main");
    if (!main) return [];
    return [].filter.call(main.querySelectorAll("img"), function (img) { return !img.closest("[data-cms],.article-card"); });
  }

  // Photo remplacée : on retire aussi le crédit du photographe d'origine
  function remplacer(img, url) {
    img.src = url; img.removeAttribute("srcset");
    var fig = img.closest("figure.credit, .portrait-wrap");
    var cr = fig && fig.querySelector(".photo-credit");
    if (cr) cr.remove();
  }

  function articleData(i) {
    var d = (defaults.articles || [])[i] || {};
    var o = (data.articles || [])[i] || {};
    return Object.assign({ tag: "", titre: "", resume: "", contenu: "", image: "", publie: false }, d, o);
  }
  function nbArticles() {
    return Math.max((defaults.articles || []).length, (data.articles || []).length);
  }

  function appliquer() {
    // 1. Prix
    document.querySelectorAll("[data-price]").forEach(function (s) {
      var k = s.getAttribute("data-price");
      if (prix[k] != null && prix[k] !== "") s.textContent = fmt(prix[k]);
    });

    // 2. Textes et photos de la page
    var t = (data.textes || {})[PAGE] || {};
    editables().forEach(function (el, i) { if (t[i] != null) el.innerHTML = clean(t[i]); });
    var im = (data.photos || {})[PAGE] || {};
    images().forEach(function (img, i) { if (im[i]) { remplacer(img, im[i]); } });

    // 3. Témoignages (accueil)
    var temo = document.querySelector('[data-cms="temoignages"] .grid');
    if (temo && data.temoignages && data.temoignages.length) {
      temo.innerHTML = data.temoignages.map(function (q) {
        return '<figure class="quote"><span class="quote__mark" aria-hidden="true">«</span><blockquote>' +
          esc(q.texte) + '</blockquote><figcaption>' + esc(q.prenom) + (q.ville ? " · " + esc(q.ville) : "") + "</figcaption></figure>";
      }).join("");
    }

    // 4. Articles (page Conseils)
    var grid = document.querySelector(".grid--articles");
    if (grid) {
      for (var i = 0; i < nbArticles(); i++) {
        var a = articleData(i);
        var card = grid.querySelector('[data-article="' + i + '"]');
        if (!card) {
          card = document.createElement("article");
          card.className = "article-card"; card.setAttribute("data-article", i);
          card.innerHTML = '<img alt="" width="1400" height="933" loading="lazy"><div class="article-card__body"><p class="article-card__tag"></p><h3 class="h3" style="font-size:22px"></h3><p></p><p class="article-card__soon">Article à paraître</p></div>';
          grid.appendChild(card);
        }
        if (a.supprime) { card.remove(); continue; }
        var img = card.querySelector("img");
        if (a.image) img.src = /^data:/.test(a.image) ? a.image : ROOT + a.image;
        img.alt = a.titre;
        card.querySelector(".article-card__tag").textContent = a.tag;
        card.querySelector("h3").textContent = a.titre;
        card.querySelector(".article-card__body > p:not(.article-card__tag):not(.article-card__soon)").textContent = a.resume;
        var action = card.querySelector(".article-card__soon, .article-card__link");
        if (a.publie && action) {
          var link = document.createElement("a");
          link.className = "article-card__link";
          link.href = ROOT + "conseils-et-ressources/article/?a=" + i;
          link.textContent = "Lire l’article →";
          action.replaceWith(link);
        }
      }
    }

    // 5. Page article
    var art = document.getElementById("cms-article");
    if (art) {
      var n = parseInt(params.get("a"), 10);
      var x = isNaN(n) ? null : articleData(n);
      if (x && x.publie && !x.supprime) {
        document.title = x.titre + " | Entre proches";
        var crumb = document.getElementById("cms-article-crumb");
        if (crumb) crumb.textContent = x.titre;
        var corps = String(x.contenu || x.resume).split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>"; }).join("");
        art.innerHTML = '<p class="article-card__tag">' + esc(x.tag) + '</p><h1 class="h1" style="font-size:clamp(32px,4.2vw,52px)">' + esc(x.titre) +
          "</h1>" + (x.image ? '<img class="photo photo--landscape" src="' + esc(/^data:/.test(x.image) ? x.image : ROOT + x.image) + '" alt="">' : "") +
          '<div class="stack" style="gap:16px">' + corps + '</div><div><a class="btn btn--outline" href="' + ROOT + 'conseils-et-ressources/">Retour aux conseils</a></div>';
      }
    }
  }

  function aDesModifs() {
    return !!(data.prix || data.temoignages || data.articles ||
      Object.keys(data.textes || {}).length || Object.keys(data.photos || {}).length);
  }

  function bandeau() {
    if (!aDesModifs() || EDIT || PAGE === "admin/") return;
    var b = document.createElement("div");
    b.className = "cms-bandeau";
    b.innerHTML = 'Aperçu démo : ce site affiche les modifications faites dans le back-office (enregistrées dans ce navigateur uniquement). ' +
      '<a href="' + ROOT + 'admin/">Back-office</a> · <button type="button">Revenir au site d’origine</button>';
    b.querySelector("button").addEventListener("click", function () {
      if (confirm("Effacer toutes les modifications de la démo ?")) { localStorage.removeItem(KEY); location.reload(); }
    });
    document.body.appendChild(b);
  }

  function modeEdition() {
    document.documentElement.classList.add("cms-editing");
    var notifier = function (msg) { try { window.parent.postMessage({ type: "cms", msg: msg }, location.origin); } catch (e) {} };
    var timer;
    var page = function () { data = load(); data.textes = data.textes || {}; data.textes[PAGE] = data.textes[PAGE] || {}; return data.textes[PAGE]; };

    editables().forEach(function (el, i) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("data-cms-i", i);
      el.addEventListener("input", function () {
        clearTimeout(timer);
        notifier("saving");
        timer = setTimeout(function () {
          var p = page(); p[i] = clean(el.innerHTML);
          if (save(data)) notifier("saved");
        }, 500);
      });
    });

    var input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.hidden = true;
    document.body.appendChild(input);
    var cible = null;
    images().forEach(function (img, i) {
      img.classList.add("cms-img");
      img.title = "Cliquer pour remplacer la photo";
      img.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); cible = { img: img, i: i }; input.value = ""; input.click(); });
    });
    input.addEventListener("change", function () {
      if (!input.files[0] || !cible) return;
      notifier("saving");
      lireImage(input.files[0], 1400, function (url) {
        data = load(); data.photos = data.photos || {}; data.photos[PAGE] = data.photos[PAGE] || {};
        data.photos[PAGE][cible.i] = url;
        if (save(data)) { remplacer(cible.img, url); notifier("saved"); }
      });
    });

    // Pas de navigation pendant l'édition
    document.addEventListener("click", function (e) { if (e.target.closest("a")) e.preventDefault(); }, true);
    document.addEventListener("submit", function (e) { e.preventDefault(); }, true);
    notifier("ready");
  }

  appliquer();
  if (EDIT) modeEdition(); else bandeau();
})();
