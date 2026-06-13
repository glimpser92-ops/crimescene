// =====================================================================
// Evidence visuals shared by the player and display screens.
// Generates lightweight SVG "evidence photos" from clue metadata.
// =====================================================================
(function () {
  const ART = {
    1: { shape: 'robot', primary: '#f4c542', accent: '#28e0ff', label: 'BROKEN ROBOT' },
    2: { shape: 'footprint', primary: '#b75b38', accent: '#ffd23c', label: 'MUD PRINT' },
    3: { shape: 'key', primary: '#b44cff', accent: '#28e0ff', label: 'KEYRING' },
    4: { shape: 'desk', primary: '#28e0ff', accent: '#ffd23c', label: 'CLEAN DESK' },
    5: { shape: 'sketch', primary: '#36a3ff', accent: '#28e0ff', label: 'INK DROPS' },
    6: { shape: 'powder', primary: '#e7eaff', accent: '#b44cff', label: 'POWDER' },
    7: { shape: 'monitor', primary: '#28e0ff', accent: '#3cff9e', label: 'SAVED FILE' },
    8: { shape: 'mask', primary: '#3cff9e', accent: '#28e0ff', label: 'SLEEP MASK' },
    9: { shape: 'microphone', primary: '#8892bd', accent: '#28e0ff', label: 'DUSTY MIC' },
    10: { shape: 'mudtracks', primary: '#b75b38', accent: '#ff8a3c', label: 'GARDEN TRACKS' },
    11: { shape: 'basketball', primary: '#ff8a3c', accent: '#ffd23c', label: 'BALL' },
    12: { shape: 'branch', primary: '#3cff9e', accent: '#ffd23c', label: 'YELLOW SHARD' },
    13: { shape: 'key', primary: '#b44cff', accent: '#ff4cd8', label: 'BROKEN RING' },
    14: { shape: 'receipt', primary: '#f7ecd0', accent: '#ffd23c', label: 'RECEIPT' },
    15: { shape: 'phone', primary: '#28e0ff', accent: '#3cff9e', label: 'MESSAGE' },
    16: { shape: 'shoe', primary: '#b75b38', accent: '#28e0ff', label: 'SHOE SOLE' },
    17: { shape: 'towel', primary: '#7da7ff', accent: '#28e0ff', label: 'SWEAT TOWEL' },
    18: { shape: 'note', primary: '#ffd23c', accent: '#ff3b5c', label: 'ANGRY NOTE' },
    19: { shape: 'cloth', primary: '#0f1427', accent: '#ff3b5c', label: 'OIL CLOTH' },
    20: { shape: 'fragment', primary: '#ffd23c', accent: '#28e0ff', label: 'ACRYLIC' },
    21: { shape: 'paintbox', primary: '#36a3ff', accent: '#ff4cd8', label: 'PAINT BOX' },
    22: { shape: 'notebook', primary: '#7da7ff', accent: '#28e0ff', label: 'NOTEBOOK' },
    23: { shape: 'earplugs', primary: '#ff8a3c', accent: '#ffd23c', label: 'EARPLUGS' },
    24: { shape: 'chart', primary: '#3cff9e', accent: '#28e0ff', label: 'NOISE LOG' },
  };

  const LOCATION_TONE = {
    science: '#28e0ff',
    art: '#b44cff',
    broadcast: '#3cff9e',
    garden: '#ff8a3c',
    'bag-odeokhu': '#b44cff',
    'bag-parkcheyuk': '#ff8a3c',
    'bag-nabeomin': '#28e0ff',
    'bag-leemobeom': '#3cff9e',
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function svgEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    }[ch]));
  }

  function shapeSvg(kind, primary, accent) {
    const dark = '#080a16';
    const pale = '#e8ecff';
    const stroke = `stroke="${pale}" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
    const fillPrimary = `fill="${primary}"`;
    const fillAccent = `fill="${accent}"`;

    switch (kind) {
      case 'robot':
        return `
          <g transform="translate(84 62) rotate(-12)">
            <rect x="48" y="32" width="155" height="96" rx="24" ${fillPrimary} stroke="${dark}" stroke-width="7"/>
            <circle cx="86" cy="75" r="12" fill="${dark}"/><circle cx="160" cy="75" r="12" fill="${dark}"/>
            <path d="M85 111 L161 111" ${stroke}/>
            <rect x="21" y="84" width="52" height="31" rx="14" ${fillPrimary} stroke="${dark}" stroke-width="7"/>
            <rect x="178" y="84" width="65" height="31" rx="14" ${fillPrimary} stroke="${dark}" stroke-width="7"/>
            <path d="M125 32 L125 6" ${stroke}/><circle cx="125" cy="2" r="10" ${fillAccent}/>
            <path d="M44 157 l74 -24 l-31 73 z M146 145 l88 20 l-78 48 z" fill="${accent}" opacity=".82"/>
          </g>`;
      case 'footprint':
      case 'mudtracks':
        return `
          <g transform="translate(93 36) rotate(13)">
            ${[0, 1, 2, 3].map((n) => `<ellipse cx="${60 + n * 16}" cy="${28 - n * 2}" rx="10" ry="16" ${fillPrimary} opacity=".88"/>`).join('')}
            <ellipse cx="95" cy="94" rx="39" ry="72" ${fillPrimary} opacity=".92"/>
            <path d="M58 95 C76 73,113 71,135 95 M68 126 C88 143,111 145,130 124" ${stroke} opacity=".45"/>
          </g>
          <g transform="translate(190 145) rotate(13)" opacity=".58">
            <ellipse cx="45" cy="22" rx="8" ry="12" ${fillPrimary}/><ellipse cx="78" cy="70" rx="30" ry="54" ${fillPrimary}/>
          </g>`;
      case 'key':
        return `
          <g transform="translate(70 88) rotate(-18)">
            <circle cx="61" cy="61" r="44" fill="none" stroke="${primary}" stroke-width="16"/>
            <path d="M101 61 H244" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
            <path d="M184 61 V96 M218 61 V86" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
            <path d="M42 96 L26 116" ${stroke} opacity=".55"/>
          </g>`;
      case 'desk':
        return `
          <g transform="translate(50 78)">
            <rect x="12" y="82" width="266" height="60" rx="8" fill="#442e24" stroke="${primary}" stroke-opacity=".55" stroke-width="4"/>
            <path d="M37 82 V158 M250 82 V158" ${stroke} opacity=".35"/>
            <rect x="66" y="28" width="52" height="54" rx="8" ${fillAccent}/>
            <rect x="138" y="17" width="74" height="65" rx="8" fill="#12182e" stroke="${primary}" stroke-width="5"/>
            <path d="M51 42 L230 28" stroke="${primary}" stroke-width="8" stroke-linecap="round"/>
          </g>`;
      case 'sketch':
        return `
          <g transform="translate(84 35) rotate(8)">
            <rect x="23" y="14" width="183" height="210" rx="10" fill="#edf2ff"/>
            <path d="M61 70 C94 35,124 111,164 70 M61 126 C96 90,120 160,168 123" fill="none" stroke="#16213f" stroke-width="5"/>
            ${[0, 1, 2, 3, 4].map((n) => `<circle cx="${55 + n * 31}" cy="${170 + (n % 2) * 12}" r="${13 + n}" fill="${primary}" opacity=".52"/>`).join('')}
          </g>`;
      case 'powder':
        return `
          <g transform="translate(70 76)">
            <path d="M35 128 C80 70,181 65,244 132 C192 164,93 171,35 128Z" fill="${primary}" opacity=".82"/>
            <path d="M72 101 C112 83,167 80,211 105" stroke="${accent}" stroke-width="7" fill="none" opacity=".5"/>
            <ellipse cx="91" cy="61" rx="27" ry="44" fill="none" stroke="${accent}" stroke-width="7" opacity=".45"/>
          </g>`;
      case 'monitor':
        return `
          <g transform="translate(58 62)">
            <rect x="22" y="18" width="242" height="150" rx="12" fill="#091225" stroke="${primary}" stroke-width="7"/>
            <path d="M63 62 H220 M63 91 H181 M63 120 H204" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
            <path d="M137 168 V206 M92 207 H203" ${stroke}/>
          </g>`;
      case 'mask':
        return `
          <g transform="translate(54 82)">
            <path d="M27 76 C71 12,227 12,270 77 C227 132,70 131,27 76Z" fill="${primary}" opacity=".9"/>
            <circle cx="99" cy="75" r="15" fill="${dark}"/><circle cx="197" cy="75" r="15" fill="${dark}"/>
            <path d="M27 77 C1 96,-7 42,22 33 M270 77 C304 98,312 39,277 33" fill="none" stroke="${accent}" stroke-width="8"/>
          </g>`;
      case 'microphone':
        return `
          <g transform="translate(115 40)">
            <rect x="62" y="12" width="74" height="126" rx="35" fill="#111827" stroke="${primary}" stroke-width="8"/>
            <path d="M80 38 H118 M80 65 H118 M80 92 H118" stroke="${accent}" stroke-width="6" opacity=".5"/>
            <path d="M31 100 C31 177,166 177,166 100 M99 177 V224 M54 224 H145" ${stroke}/>
          </g>`;
      case 'basketball':
        return `
          <g transform="translate(88 46)">
            <circle cx="104" cy="104" r="95" ${fillPrimary} stroke="${dark}" stroke-width="8"/>
            <path d="M42 34 C84 74,125 139,155 193 M168 28 C132 81,90 137,51 177 M10 104 H198 M104 9 V199" fill="none" stroke="${dark}" stroke-width="8" opacity=".72"/>
            <path d="M136 196 C186 184,224 171,258 141" stroke="${accent}" stroke-width="11" stroke-linecap="round" opacity=".65"/>
          </g>`;
      case 'branch':
        return `
          <g transform="translate(48 55)">
            <path d="M18 185 C95 119,166 91,284 29" stroke="#5a3d24" stroke-width="18" stroke-linecap="round"/>
            <path d="M117 116 L96 58 M168 89 L191 35 M216 62 L252 86" stroke="#5a3d24" stroke-width="10" stroke-linecap="round"/>
            <path d="M177 74 l51 -18 l-19 54 z" ${fillAccent} stroke="${primary}" stroke-width="5"/>
            <path d="M91 70 C74 52,70 35,74 18 M238 84 C263 77,284 82,300 98" stroke="${primary}" stroke-width="7" opacity=".7"/>
          </g>`;
      case 'receipt':
        return `
          <g transform="translate(104 35) rotate(-4)">
            <path d="M24 18 H183 V231 l-24 -13 -22 13 -22 -13 -22 13 -23 -13 -22 13 -24 -13 Z" fill="${primary}" stroke="${accent}" stroke-width="5"/>
            <path d="M55 69 H153 M55 104 H135 M55 139 H165 M55 176 H116" stroke="#1a1d2f" stroke-width="8" stroke-linecap="round"/>
            <circle cx="153" cy="176" r="12" fill="${accent}"/>
          </g>`;
      case 'phone':
        return `
          <g transform="translate(112 32)">
            <rect x="20" y="9" width="154" height="238" rx="24" fill="#0b1022" stroke="${primary}" stroke-width="8"/>
            <rect x="43" y="45" width="108" height="31" rx="12" ${fillAccent}/>
            <rect x="43" y="94" width="82" height="31" rx="12" fill="${primary}" opacity=".8"/>
            <rect x="43" y="143" width="105" height="31" rx="12" ${fillAccent} opacity=".7"/>
            <circle cx="98" cy="220" r="10" fill="${primary}"/>
          </g>`;
      case 'shoe':
        return `
          <g transform="translate(47 89) rotate(-12)">
            <path d="M18 117 C71 46,147 33,270 83 C274 112,251 137,209 145 H65 C35 145,17 135,18 117Z" fill="#f4f7ff" stroke="${primary}" stroke-width="8"/>
            <path d="M47 120 H246" stroke="${dark}" stroke-width="13" stroke-linecap="round"/>
            <path d="M88 89 h101" stroke="${primary}" stroke-width="7" stroke-linecap="round"/>
            <path d="M198 112 l42 -11 l-15 42 z" fill="${accent}" stroke="${dark}" stroke-width="4"/>
          </g>`;
      case 'towel':
        return `
          <g transform="translate(61 74)">
            <path d="M47 33 H245 V180 C186 157,121 206,47 176Z" fill="${primary}" stroke="${accent}" stroke-width="7"/>
            <path d="M75 65 C121 84,167 55,218 74 M77 109 C124 133,172 91,218 116" fill="none" stroke="#e8ecff" stroke-width="7" opacity=".45"/>
            <circle cx="244" cy="198" r="18" fill="${accent}" opacity=".7"/>
          </g>`;
      case 'note':
        return `
          <g transform="translate(74 42) rotate(-7)">
            <path d="M21 38 L207 14 L239 211 L43 230 Z" fill="${primary}" stroke="${accent}" stroke-width="6"/>
            <path d="M62 80 H185 M69 119 H205 M76 158 H174" stroke="#271900" stroke-width="9" stroke-linecap="round"/>
            <path d="M185 37 L222 70" stroke="${accent}" stroke-width="9" opacity=".85"/>
          </g>`;
      case 'cloth':
        return `
          <g transform="translate(55 66)">
            <path d="M39 66 C72 11,134 50,176 32 C231 9,278 71,248 130 C217 190,150 146,103 171 C44 201,5 122,39 66Z" fill="#d7d7d4" stroke="${primary}" stroke-width="8"/>
            <path d="M80 88 C113 57,148 96,188 74 M74 131 C112 109,147 149,208 119" stroke="${accent}" stroke-width="14" opacity=".85" stroke-linecap="round"/>
            <circle cx="196" cy="91" r="20" fill="#05060d" opacity=".62"/>
          </g>`;
      case 'fragment':
        return `
          <g transform="translate(55 45)">
            <path d="M86 42 l69 13 l-32 65 z M170 103 l87 -29 l-15 102 z M63 137 l61 45 l-77 38 z" ${fillPrimary} stroke="${accent}" stroke-width="6"/>
            <path d="M105 59 L121 105 M202 103 L232 155 M78 155 L90 198" ${stroke} opacity=".45"/>
          </g>`;
      case 'paintbox':
        return `
          <g transform="translate(54 72)">
            <rect x="30" y="26" width="252" height="158" rx="18" fill="#0f1427" stroke="${primary}" stroke-width="7"/>
            ${['#ff3b5c', '#ffd23c', '#3cff9e', '#28e0ff', '#b44cff', '#ff8a3c'].map((c, i) => `<circle cx="${76 + i * 35}" cy="83" r="18" fill="${c}"/>`).join('')}
            <path d="M66 137 H243" stroke="${accent}" stroke-width="12" stroke-linecap="round"/>
          </g>`;
      case 'notebook':
        return `
          <g transform="translate(84 38) rotate(5)">
            <rect x="24" y="18" width="186" height="218" rx="12" fill="#eef3ff" stroke="${primary}" stroke-width="7"/>
            <path d="M65 18 V236" stroke="${accent}" stroke-width="7"/>
            <path d="M88 67 H175 M88 101 H165 M88 135 H180 M88 169 H154" stroke="#18213f" stroke-width="7" stroke-linecap="round"/>
            <path d="M41 55 H22 M41 93 H22 M41 131 H22 M41 169 H22" stroke="${primary}" stroke-width="7"/>
          </g>`;
      case 'earplugs':
        return `
          <g transform="translate(87 57)">
            <path d="M52 38 C90 11,127 40,107 81 L76 146 C60 177,18 157,31 122Z" ${fillPrimary} stroke="${accent}" stroke-width="7"/>
            <path d="M181 38 C219 11,256 40,236 81 L205 146 C189 177,147 157,160 122Z" ${fillPrimary} stroke="${accent}" stroke-width="7"/>
            <path d="M111 158 C139 178,165 178,193 158" fill="none" stroke="${accent}" stroke-width="8" opacity=".65"/>
          </g>`;
      case 'chart':
      default:
        return `
          <g transform="translate(62 54)">
            <rect x="26" y="28" width="245" height="177" rx="14" fill="#0d1427" stroke="${primary}" stroke-width="7"/>
            <path d="M65 161 V91 M112 161 V66 M159 161 V119 M206 161 V48" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
            <path d="M58 161 H238" ${stroke}/>
          </g>`;
    }
  }

  function svgMarkup(clue) {
    const art = ART[clue.id] || { shape: 'chart', primary: LOCATION_TONE[clue.loc] || '#28e0ff', accent: '#b44cff', label: 'EVIDENCE' };
    const tone = LOCATION_TONE[clue.loc] || art.accent;
    const title = svgEscape(art.label || clue.title);
    const no = String(clue.id).padStart(2, '0');
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 260" role="img" aria-label="${svgEscape(clue.title)}">
        <defs>
          <linearGradient id="bg-${no}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0d1027"/>
            <stop offset=".52" stop-color="#121832"/>
            <stop offset="1" stop-color="#060611"/>
          </linearGradient>
          <radialGradient id="glow-${no}" cx=".3" cy=".15" r=".88">
            <stop offset="0" stop-color="${tone}" stop-opacity=".34"/>
            <stop offset=".62" stop-color="${art.primary}" stop-opacity=".13"/>
            <stop offset="1" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="360" height="260" rx="22" fill="url(#bg-${no})"/>
        <rect width="360" height="260" rx="22" fill="url(#glow-${no})"/>
        <path d="M20 34 H340 M20 226 H340" stroke="${tone}" stroke-opacity=".18" stroke-width="2"/>
        <g opacity=".16" stroke="${tone}" stroke-width="1">
          ${Array.from({ length: 8 }).map((_, i) => `<path d="M${20 + i * 46} 0 V260"/>`).join('')}
          ${Array.from({ length: 5 }).map((_, i) => `<path d="M0 ${33 + i * 43} H360"/>`).join('')}
        </g>
        ${shapeSvg(art.shape, art.primary, art.accent)}
        <rect x="22" y="20" width="92" height="31" rx="8" fill="#050713" stroke="${tone}" stroke-opacity=".55"/>
        <text x="38" y="42" fill="${tone}" font-family="monospace" font-size="18" font-weight="700">NO.${no}</text>
        <rect x="194" y="210" width="139" height="31" rx="6" fill="#050713" stroke="${art.primary}" stroke-opacity=".45"/>
        <text x="207" y="232" fill="#e8ecff" font-family="monospace" font-size="14" font-weight="700">${title}</text>
        <circle cx="319" cy="42" r="11" fill="${art.accent}" opacity=".9"/>
      </svg>`;
  }

  const GENERATED_CLUES = Array.from({ length: 24 }, (_, i) => i + 1);
  const CLUE_IMAGE_VERSION = '20260613-consistency';

  function clueNumberLabel(value) {
    if (value === undefined || value === null || value === '') return '';
    const label = String(value);
    return /^\d+$/.test(label) ? label.padStart(2, '0') : label;
  }

  function clueImageSrcSvg(clue) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup(clue))}`;
  }

  function clueImageSrc(clue) {
    if (GENERATED_CLUES.includes(clue.id)) {
      return `/images/clues/clue_${clue.id}.png?v=${CLUE_IMAGE_VERSION}`;
    }
    return clueImageSrcSvg(clue);
  }

  function cluePhoto(clue, options = {}) {
    if (!clue) return '';
    const classes = [
      'evidence-photo',
      options.mini ? 'evidence-photo--mini' : '',
      options.large ? 'evidence-photo--large' : '',
      options.wide ? 'evidence-photo--wide' : '',
    ].filter(Boolean).join(' ');
    const caption = options.caption === false ? '' : `
      <figcaption>
        <span>Evidence ${String(clue.id).padStart(2, '0')}</span>
        <b>${escapeHtml(clue.title)}</b>
      </figcaption>`;
    const numberLabel = clueNumberLabel(options.number);
    const numberBadge = numberLabel
      ? `<span class="evidence-photo-number" aria-hidden="true">${escapeHtml(numberLabel)}</span>`
      : '';
    const svgUri = clueImageSrcSvg(clue);
    const imgSrc = clueImageSrc(clue);
    const clueLabel = `단서 ${String(clue.id).padStart(2, '0')} · ${clue.title}`;
    return `
      <figure class="${classes}" tabindex="0" role="button" aria-label="단서 사진 확대: ${escapeHtml(clueLabel)}" data-clue-label="${escapeHtml(clueLabel)}" style="--evidence-accent:${LOCATION_TONE[clue.loc] || '#28e0ff'}">
        <img src="${imgSrc}" onerror="if(this.src!=='${svgUri}'){this.src='${svgUri}';}" alt="${escapeHtml(clue.title)}" loading="lazy" />
        ${numberBadge}
        ${caption}
      </figure>`;
  }

  function zoneBoard(zoneKey, clues, meta = {}) {
    const tone = LOCATION_TONE[zoneKey] || '#28e0ff';
    return `
      <div class="zone-evidence-board scan-reveal" style="--evidence-accent:${tone}">
        <div class="zone-evidence-title">
          <span>${escapeHtml(meta.emoji || '🔎')}</span>
          <div>
            <b>${escapeHtml(meta.name || '조사 구역')}</b>
            <em>${escapeHtml(meta.desc || '단서 스캔 중')}</em>
          </div>
        </div>
        <div class="zone-evidence-photos">
          ${(clues || []).map((clue) => cluePhoto(clue, { mini: true, caption: false, number: clue.id })).join('')}
        </div>
      </div>`;
  }

  let lightbox;

  function ensureLightbox() {
    if (lightbox) return lightbox;
    if (!document.body) return null;

    lightbox = document.createElement('div');
    lightbox.id = 'clue-lightbox';
    lightbox.className = 'clue-lightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML = `
      <button type="button" class="clue-lightbox-close" aria-label="확대 사진 닫기">&times;</button>
      <div class="clue-lightbox-frame" role="dialog" aria-modal="true" aria-label="단서 사진 확대 보기">
        <img class="clue-lightbox-image" alt="" />
        <div class="clue-lightbox-caption"></div>
      </div>`;
    document.body.appendChild(lightbox);
    return lightbox;
  }

  function captionForImage(img) {
    const photo = img.closest('.evidence-photo');
    const clueLabel = photo?.dataset?.clueLabel;
    if (clueLabel) return clueLabel;
    const evidenceNo = photo?.querySelector('figcaption span')?.textContent?.trim();
    const evidenceTitle = photo?.querySelector('figcaption b')?.textContent?.trim();
    if (evidenceNo && evidenceTitle) return `${evidenceNo} · ${evidenceTitle}`;
    if (evidenceTitle) return evidenceTitle;

    const zoneTitle = document.querySelector('#zone-detail-title')?.textContent?.trim();
    return img.alt || zoneTitle || '단서 사진';
  }

  function openLightboxFromImage(img) {
    const box = ensureLightbox();
    if (!box || !img) return;

    const largeImage = box.querySelector('.clue-lightbox-image');
    const caption = box.querySelector('.clue-lightbox-caption');
    largeImage.src = img.currentSrc || img.src;
    largeImage.alt = img.alt || '단서 사진';
    caption.textContent = captionForImage(img);
    document.documentElement.classList.add('clue-lightbox-lock');
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    box.querySelector('.clue-lightbox-close')?.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.querySelector('.clue-lightbox-image')?.removeAttribute('src');
    document.documentElement.classList.remove('clue-lightbox-lock');
  }

  function findZoomImage(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('.evidence-photo img, .zone-visual-image')
      || target.closest('.evidence-photo')?.querySelector('img')
      || null;
  }

  function installLightbox() {
    if (window.__crimeSceneLightboxInstalled) return;
    window.__crimeSceneLightboxInstalled = true;

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('.clue-lightbox-close')) {
        closeLightbox();
        return;
      }

      if (lightbox && event.target === lightbox) {
        closeLightbox();
        return;
      }

      const img = findZoomImage(event.target);
      if (!img) return;
      event.preventDefault();
      openLightboxFromImage(img);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') return;
      const focusedPhoto = document.activeElement?.closest?.('.evidence-photo');
      if (!focusedPhoto) return;
      const img = focusedPhoto.querySelector('img');
      if (!img) return;
      event.preventDefault();
      openLightboxFromImage(img);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installLightbox);
  } else {
    installLightbox();
  }

  window.CrimeSceneVisuals = { cluePhoto, clueImageSrc, zoneBoard, openLightboxFromImage };
})();
