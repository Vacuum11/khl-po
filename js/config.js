// ============================================================
// FIREBASE CONFIG — заполни своими данными из консоли Firebase
// console.firebase.google.com → Project Settings → Your apps
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAo1Dk9QOKd6gnxi0FktCTkiS_79C_L3K0",
  authDomain: "khl-po-2026.firebaseapp.com",
  projectId: "khl-po-2026",
  storageBucket: "khl-po-2026.firebasestorage.app",
  messagingSenderId: "243676632030",
  appId: "1:243676632030:web:d0d2508f54d6d73f20034f",
  measurementId: "G-CFFMYNVBWB"
};

// ============================================================
// СЕТКА КХЛ 2026 — РЕДАКТИРУЙ ЗДЕСЬ КОГДА СТАНУТ ИЗВЕСТНЫ ПАРЫ
// home = команда с преимуществом своего льда (посев выше)
// ============================================================
const BRACKET = {
  rounds: 4,
  west: {
    name: "Запад",
    r1: [
      { id: "w1", home: "Локомотив",    away: "Спартак"      },  // 1 vs 8
      { id: "w2", home: "ЦСКА",         away: "СКА"          },  // 4 vs 5
      { id: "w3", home: "Дин. Минск",   away: "Дин. Москва"  },  // 2 vs 7
      { id: "w4", home: "Северсталь",   away: "Торпедо"      }   // 3 vs 6
    ]
  },
  east: {
    name: "Восток",
    r1: [
      { id: "e1", home: "Металлург",    away: "Сибирь"        },  // 1 vs 8
      { id: "e2", home: "Автомобилист", away: "Салават Юл"    },  // 4 vs 5
      { id: "e3", home: "Авангард",     away: "Нефтехимик"    },  // 2 vs 7
      { id: "e4", home: "Ак Барс",      away: "Трактор"       }   // 3 vs 6
    ]
  }
};

// ============================================================
// ЛОГОТИПЫ КОМАНД — Wikimedia Commons (Special:FilePath redirect)
// Фолбэк: инициалы из CSS при ошибке загрузки
// ============================================================
const TEAM_LOGOS = {
  // Западная конференция
  "Локомотив":   "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Lokomotiv_Yaroslavl_Logo.svg",
  "Спартак":     "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Spartak_Moscow_Logo.svg",
  "ЦСКА":        "https://commons.wikimedia.org/wiki/Special:FilePath/HC_CSKA_Moscow_Logo.svg",
  "СКА":         "https://commons.wikimedia.org/wiki/Special:FilePath/HC_SKA_Saint_Petersburg_Logo.svg",
  "Дин. Минск":  "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Dinamo_Minsk_Logo.svg",
  "Дин. Москва": "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Dynamo_Moscow_Logo.svg",
  "Северсталь":  "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Severstal_Cherepovets_Logo.svg",
  "Торпедо":     "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Torpedo_Nizhny_Novgorod_Logo.svg",
  // Восточная конференция
  "Металлург":   "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Metallurg_Magnitogorsk_Logo.svg",
  "Сибирь":      "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Sibir_Novosibirsk_Logo.svg",
  "Автомобилист":"https://commons.wikimedia.org/wiki/Special:FilePath/HC_Avtomobilist_Yekaterinburg_Logo.svg",
  "Салават Юл":  "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Salavat_Yulaev_Ufa_Logo.svg",
  "Авангард":    "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Avangard_Omsk_Logo.svg",
  "Нефтехимик":  "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Neftekhimik_Nizhnekamsk_Logo.svg",
  "Ак Барс":     "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Ak_Bars_Kazan_Logo.svg",
  "Трактор":     "https://commons.wikimedia.org/wiki/Special:FilePath/HC_Traktor_Chelyabinsk_Logo.svg",
};

// Helper: возвращает HTML тега <img> с логотипом команды + фолбэк на инициалы
function teamLogoHtml(team, size = 26) {
  const url = TEAM_LOGOS[team];
  if (!url) return '';
  const initials = team.replace(/[^А-ЯA-Z]/g, '').slice(0, 2) || team.slice(0, 2).toUpperCase();
  return `<img class="team-logo" src="${url}" width="${size}" height="${size}" alt="${team}"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy">
  <span class="team-logo-fallback" style="display:none;width:${size}px;height:${size}px">${initials}</span>`;
}

// Названия раундов
const ROUND_NAMES = [
  "1/8 финала",
  "1/4 финала",
  "1/2 финала",
  "Финал Кубка Гагарина"
];

// ============================================================
// ОЧКИ ЗА ПРАВИЛЬНЫЕ ПРОГНОЗЫ
// ============================================================
const SCORING = {
  winnerPoints: [1, 2, 4, 8],  // очки за победителя серии по раундам
  seriesScoreBonus: 1           // бонус за угаданный счёт серии (4:0 / 4:1 / 4:2 / 4:3)
};
