// Русские названия и флаги. Ключи — названия команд из football-data.org.
// Если команды нет в словаре — покажем английское название, ничего не сломается.
export const TEAMS: Record<string, { ru: string; flag: string }> = {
  // хозяева и Америка
  'United States': { ru: 'США', flag: '🇺🇸' },
  USA: { ru: 'США', flag: '🇺🇸' },
  Mexico: { ru: 'Мексика', flag: '🇲🇽' },
  Canada: { ru: 'Канада', flag: '🇨🇦' },
  Argentina: { ru: 'Аргентина', flag: '🇦🇷' },
  Brazil: { ru: 'Бразилия', flag: '🇧🇷' },
  Uruguay: { ru: 'Уругвай', flag: '🇺🇾' },
  Colombia: { ru: 'Колумбия', flag: '🇨🇴' },
  Ecuador: { ru: 'Эквадор', flag: '🇪🇨' },
  Paraguay: { ru: 'Парагвай', flag: '🇵🇾' },
  Chile: { ru: 'Чили', flag: '🇨🇱' },
  Peru: { ru: 'Перу', flag: '🇵🇪' },
  Venezuela: { ru: 'Венесуэла', flag: '🇻🇪' },
  Bolivia: { ru: 'Боливия', flag: '🇧🇴' },
  Panama: { ru: 'Панама', flag: '🇵🇦' },
  'Costa Rica': { ru: 'Коста-Рика', flag: '🇨🇷' },
  Honduras: { ru: 'Гондурас', flag: '🇭🇳' },
  Jamaica: { ru: 'Ямайка', flag: '🇯🇲' },
  Curaçao: { ru: 'Кюрасао', flag: '🇨🇼' },
  Curacao: { ru: 'Кюрасао', flag: '🇨🇼' },
  Haiti: { ru: 'Гаити', flag: '🇭🇹' },
  Suriname: { ru: 'Суринам', flag: '🇸🇷' },
  // Европа
  England: { ru: 'Англия', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  France: { ru: 'Франция', flag: '🇫🇷' },
  Germany: { ru: 'Германия', flag: '🇩🇪' },
  Spain: { ru: 'Испания', flag: '🇪🇸' },
  Portugal: { ru: 'Португалия', flag: '🇵🇹' },
  Italy: { ru: 'Италия', flag: '🇮🇹' },
  Netherlands: { ru: 'Нидерланды', flag: '🇳🇱' },
  Belgium: { ru: 'Бельгия', flag: '🇧🇪' },
  Croatia: { ru: 'Хорватия', flag: '🇭🇷' },
  Switzerland: { ru: 'Швейцария', flag: '🇨🇭' },
  Austria: { ru: 'Австрия', flag: '🇦🇹' },
  Poland: { ru: 'Польша', flag: '🇵🇱' },
  Denmark: { ru: 'Дания', flag: '🇩🇰' },
  Norway: { ru: 'Норвегия', flag: '🇳🇴' },
  Sweden: { ru: 'Швеция', flag: '🇸🇪' },
  Scotland: { ru: 'Шотландия', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  Wales: { ru: 'Уэльс', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  Ireland: { ru: 'Ирландия', flag: '🇮🇪' },
  'Czech Republic': { ru: 'Чехия', flag: '🇨🇿' },
  Czechia: { ru: 'Чехия', flag: '🇨🇿' },
  Slovakia: { ru: 'Словакия', flag: '🇸🇰' },
  Slovenia: { ru: 'Словения', flag: '🇸🇮' },
  Serbia: { ru: 'Сербия', flag: '🇷🇸' },
  Hungary: { ru: 'Венгрия', flag: '🇭🇺' },
  Romania: { ru: 'Румыния', flag: '🇷🇴' },
  Ukraine: { ru: 'Украина', flag: '🇺🇦' },
  Türkiye: { ru: 'Турция', flag: '🇹🇷' },
  Turkey: { ru: 'Турция', flag: '🇹🇷' },
  Greece: { ru: 'Греция', flag: '🇬🇷' },
  Albania: { ru: 'Албания', flag: '🇦🇱' },
  'North Macedonia': { ru: 'Сев. Македония', flag: '🇲🇰' },
  'Bosnia and Herzegovina': { ru: 'Босния', flag: '🇧🇦' },
  Iceland: { ru: 'Исландия', flag: '🇮🇸' },
  Finland: { ru: 'Финляндия', flag: '🇫🇮' },
  Kosovo: { ru: 'Косово', flag: '🇽🇰' },
  // Африка
  Morocco: { ru: 'Марокко', flag: '🇲🇦' },
  Senegal: { ru: 'Сенегал', flag: '🇸🇳' },
  Egypt: { ru: 'Египет', flag: '🇪🇬' },
  Algeria: { ru: 'Алжир', flag: '🇩🇿' },
  Tunisia: { ru: 'Тунис', flag: '🇹🇳' },
  Nigeria: { ru: 'Нигерия', flag: '🇳🇬' },
  Cameroon: { ru: 'Камерун', flag: '🇨🇲' },
  Ghana: { ru: 'Гана', flag: '🇬🇭' },
  'Ivory Coast': { ru: 'Кот-д’Ивуар', flag: '🇨🇮' },
  "Côte d'Ivoire": { ru: 'Кот-д’Ивуар', flag: '🇨🇮' },
  'South Africa': { ru: 'ЮАР', flag: '🇿🇦' },
  'Cape Verde': { ru: 'Кабо-Верде', flag: '🇨🇻' },
  'Cape Verde Islands': { ru: 'Кабо-Верде', flag: '🇨🇻' },
  Mali: { ru: 'Мали', flag: '🇲🇱' },
  'Burkina Faso': { ru: 'Буркина-Фасо', flag: '🇧🇫' },
  'DR Congo': { ru: 'ДР Конго', flag: '🇨🇩' },
  // Азия и Океания
  Japan: { ru: 'Япония', flag: '🇯🇵' },
  'South Korea': { ru: 'Юж. Корея', flag: '🇰🇷' },
  'Korea Republic': { ru: 'Юж. Корея', flag: '🇰🇷' },
  Iran: { ru: 'Иран', flag: '🇮🇷' },
  'Saudi Arabia': { ru: 'Сауд. Аравия', flag: '🇸🇦' },
  Qatar: { ru: 'Катар', flag: '🇶🇦' },
  Australia: { ru: 'Австралия', flag: '🇦🇺' },
  Uzbekistan: { ru: 'Узбекистан', flag: '🇺🇿' },
  Jordan: { ru: 'Иордания', flag: '🇯🇴' },
  Iraq: { ru: 'Ирак', flag: '🇮🇶' },
  'United Arab Emirates': { ru: 'ОАЭ', flag: '🇦🇪' },
  'New Zealand': { ru: 'Нов. Зеландия', flag: '🇳🇿' },
}

export function teamLabel(name: string | null | undefined): string {
  if (!name) return '—'
  const t = TEAMS[name]
  return t ? `${t.flag} ${t.ru}` : name
}

export function teamFlag(name: string | null | undefined): string {
  if (!name) return ''
  return TEAMS[name]?.flag ?? '🏳️'
}

export const STAGES: Record<string, string> = {
  GROUP_STAGE: 'Групповой этап',
  LAST_32: '1/16 финала',
  LAST_16: '1/8 финала',
  QUARTER_FINALS: '1/4 финала',
  SEMI_FINALS: 'Полуфинал',
  THIRD_PLACE: 'Матч за 3-е место',
  FINAL: 'Финал',
}

export function stageLabel(m: { stage: string; group_name: string | null }): string {
  if (m.stage === 'GROUP_STAGE') {
    return m.group_name ? `Группа ${m.group_name.replace('GROUP_', '')}` : 'Групповой этап'
  }
  return STAGES[m.stage] ?? m.stage
}
