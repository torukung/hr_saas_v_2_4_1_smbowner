/* ============================================================
   ADEPTIO · i18n — bilingual scaffolding (EN now · ລາວ staged)
   The build ships English; the Lao pack is structured here so the
   later language wave (DS·multi-language) is a data drop, not a
   refactor. t(key) falls back to the key, then to EN.
   ============================================================ */
window.I18N = (function () {
  const EN = {
    "app.suite": "Adaptive HR · Owner Edition",
    "app.tagline": "One backend, two people per shop, one operator above them all",
    "nav.web": "Web",
    "nav.mobile": "Mobile",
    "common.back": "Back",
    "common.viewAll": "View all",
    "common.open": "Open",
    "common.approve": "Approve",
    "common.reject": "Reject",
    "common.signin": "Sign in",
    "common.signout": "Sign out",
    "lang.en": "EN",
    "lang.lo": "ລາວ"
  };
  // ລາວ — seeded for the bilingual payslip & auth mails already; full UI pack staged.
  const LO = {
    "app.suite": "Adaptive HR · ສະບັບເຈົ້າຂອງ",
    "common.signin": "ເຂົ້າສູ່ລະບົບ",
    "common.signout": "ອອກຈາກລະບົບ",
    "lang.en": "EN",
    "lang.lo": "ລາວ"
  };
  let lang = "en";
  const packs = { en: EN, lo: LO };
  function t(key) { return (packs[lang] && packs[lang][key]) || EN[key] || key; }
  function setLang(l) { if (packs[l]) lang = l; }
  function getLang() { return lang; }
  return { t, setLang, getLang };
})();
window.t = window.I18N.t;
