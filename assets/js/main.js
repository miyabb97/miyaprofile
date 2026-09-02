/* ==========================================================================
   UI behaviour — reveal on scroll, sticky nav, card tilt.
   Everything here degrades to a perfectly readable static page.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── current year ── */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── nav gains a surface once you leave the top ── */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 12);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── reveal on entry ── */
  var revealables = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── active section in the nav ── */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a'));
  if (links.length && 'IntersectionObserver' in window) {
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute('href')); })
      .filter(Boolean);

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── project cards: a few degrees of tilt, nothing more ── */
  if (finePointer && !reduced) {
    var MAX = 5.5; // degrees

    document.querySelectorAll('.tilt').forEach(function (card) {
      var frame = null;

      card.addEventListener('pointerenter', function () {
        card.classList.add('is-tilting');
      });

      card.addEventListener('pointermove', function (e) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width  - 0.5;
          var py = (e.clientY - r.top)  / r.height - 0.5;
          card.style.transform =
            'perspective(1400px) rotateX(' + (-py * MAX).toFixed(2) + 'deg)' +
            ' rotateY(' + (px * MAX).toFixed(2) + 'deg) translateY(-4px)';
        });
      });

      card.addEventListener('pointerleave', function () {
        if (frame) { cancelAnimationFrame(frame); frame = null; }
        card.classList.remove('is-tilting'); // let it ease back
        card.style.transform = '';
      });
    });
  }
})();
