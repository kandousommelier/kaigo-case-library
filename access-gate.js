(() => {
  'use strict';

  const sessionKey = 'kaigo-case-library-entry';

  function recordVisit() {
    const pixel = new Image(1, 1);
    pixel.alt = '';
    pixel.referrerPolicy = 'no-referrer';
    pixel.setAttribute('aria-hidden', 'true');
    pixel.style.cssText = 'position:absolute;width:1px;height:1px;clip-path:inset(50%)';
    pixel.src = 'https://kaigo-case-library.goatcounter.com/count?p=/kaigo-case-library/&rnd=' + Date.now();
    document.body.append(pixel);
  }

  function enterSite() {
    try { sessionStorage.setItem(sessionKey, 'ok'); } catch (error) {}
    document.documentElement.classList.remove('access-pending', 'access-locked');
    document.documentElement.classList.add('access-granted');
    document.querySelector('#access-gate')?.remove();
    recordVisit();
  }

  function decode(value) {
    try { return atob(value || ''); } catch (error) { return ''; }
  }

  function showGate() {
    const template = document.querySelector('#access-gate-template');
    if (!template) return enterSite();
    document.body.prepend(template.content.cloneNode(true));
    document.documentElement.classList.remove('access-pending');
    document.documentElement.classList.add('access-locked');

    const gate = document.querySelector('#access-gate');
    const form = gate.querySelector('form');
    const error = gate.querySelector('[role="alert"]');

    form.addEventListener('submit', event => {
      event.preventDefault();
      const values = new FormData(form);
      const member = String(values.get('member') || '').trim();
      const key = String(values.get('key') || '');
      const facility = String(values.get('facility') || '').trim();
      const expectedMember = decode(gate.dataset.member);
      const expectedKey = decode(gate.dataset.key);

      if (!facility) {
        error.textContent = '施設コードを入力してください。';
        form.elements.facility.focus();
        return;
      }
      if (member !== expectedMember || key !== expectedKey) {
        error.textContent = '共通IDまたは共通パスワードが正しくありません。';
        form.elements.key.value = '';
        form.elements.key.focus();
        return;
      }
      enterSite();
    });
  }

  function init() {
    try {
      if (sessionStorage.getItem(sessionKey) === 'ok') return enterSite();
    } catch (error) {}
    showGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
