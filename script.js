document.addEventListener('DOMContentLoaded', function () {
  // --- Variant switcher ---
  var switcher = document.getElementById('variantSwitch');
  var panels = document.querySelectorAll('.variant-panel');
  function showVariant(name) {
    panels.forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-variant') === name);
    });
  }
  switcher.addEventListener('change', function () {
    showVariant(this.value);
  });
  showVariant(switcher.value);

  // --- Rechner: slider label ---
  var rechnerSlider = document.getElementById('rechnerSlider');
  var rechnerSliderVal = document.getElementById('rechnerSliderVal');
  if (rechnerSlider) {
    rechnerSlider.addEventListener('input', function () {
      rechnerSliderVal.textContent = this.value + ' %';
    });
  }

  // --- Fragestrecke: stepper ---
  var fsStep = 0;
  var fsTotalQuestions = 3;
  var fsSelections = [null, null, null];
  var fsProgressBar = document.getElementById('fsProgressBar');
  var fsProgressPct = document.getElementById('fsProgressPct');
  var fsStepLabel = document.getElementById('fsStepLabel');
  var fsQuestions = document.querySelectorAll('.fs-question');
  var fsContact = document.getElementById('fsContact');
  var fsNav = document.getElementById('fsNav');
  var fsBackBtn = document.getElementById('fsBack');
  var fsNextBtn = document.getElementById('fsNext');

  function renderFs() {
    var pct = fsStep < fsTotalQuestions ? Math.round(((fsStep + 1) / fsTotalQuestions) * 100) : 100;
    fsProgressBar.style.width = pct + '%';
    fsProgressPct.textContent = pct + '%';
    fsStepLabel.textContent = fsStep < fsTotalQuestions ? ('Frage ' + (fsStep + 1) + ' von ' + fsTotalQuestions) : 'Letzter Schritt';
    fsQuestions.forEach(function (q, i) {
      q.classList.toggle('active', i === fsStep);
    });
    fsContact.classList.toggle('active', fsStep === fsTotalQuestions);
    fsNav.style.display = fsStep < fsTotalQuestions ? 'flex' : 'none';
    fsBackBtn.disabled = fsStep === 0;
  }

  document.querySelectorAll('.fs-option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      var qIndex = parseInt(this.closest('.fs-question').getAttribute('data-question'), 10);
      var options = this.parentElement.querySelectorAll('.fs-option');
      options.forEach(function (o) { o.classList.remove('selected'); });
      this.classList.add('selected');
      fsSelections[qIndex] = this.textContent;
    });
  });

  fsBackBtn.addEventListener('click', function () {
    if (fsStep > 0) { fsStep--; renderFs(); }
  });
  fsNextBtn.addEventListener('click', function () {
    if (fsStep < fsTotalQuestions) { fsStep++; renderFs(); }
  });
  renderFs();

  // --- Karte & Simulation: time slider ---
  var mapSlider = document.getElementById('mapSlider');
  var mapSliderVal = document.getElementById('mapSliderVal');
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  if (mapSlider) {
    mapSlider.addEventListener('input', function () {
      mapSliderVal.textContent = pad(parseInt(this.value, 10)) + ':00';
    });
  }
});
