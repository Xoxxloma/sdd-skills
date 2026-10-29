/**
 * Типизация выхода session-quality: формат session-quality/6.
 * Итог: <id>.quality.json рядом с выгрузкой сессии <id>.json — одна сессия.
 * Источник правды — session-quality.schema.json и contract.py; этот файл — их описание для чтения.
 *
 * Скор за период собирает дашборд из файлов сессий пользователя — суммами, а не средними:
 *   метрика: value = Σ hits / Σ events по оценённым сессиям; events < params.min_events — не измерена;
 *   балл метрики = округление(clamp((value − bad) / (good − bad), 0, 1) × 100);
 *   скор = округление(Σ вес × балл / Σ вес) по измеренным метрикам; измерено меньше min_measured_weight % веса — скора нет;
 *   есть сигнал фрода хотя бы в одной сессии — скор «не окончательный».
 *   completion: у сессии с end_break = true, если следующая сессия того же пользователя началась не позже
 *   params.continuation_hours после session.end, — к Σ hits прибавить 1 (работу продолжили, это не обрыв).
 * Скоры сессий между собой не усредняют: в сессии бывает 2–5 мест решения.
 */

/** Корень выхода. */
export type SessionQualityResult = ScoredResult | SkippedResult;

export interface ResultBase {
  schema: "session-quality/6";      // версия формата
  generated_at: string;             // когда собран, ISO 8601 с поясом: "2026-10-27T15:00:00Z"
  params: Params;                   // пороги, нужные дашборду для периода
  fraud: Fraud;                     // признаки нечестной работы: в скор не входят, но «замораживают» его
  environment: Environment;         // сбои среды, не вина пользователя: справочно
}

/** Оценённая сессия: метрики и посторонние темы есть. */
export interface ScoredResult extends ResultBase {
  session: Session & { scored: true };
  metrics: Metric[];                // ровно 7 метрик (см. MetricId)
  discipline: Discipline;           // посторонние темы: справочно, в скор не входят
}

/** Сессия короче params min_user_turns реплик: метрик и посторонних тем нет, фрод и окружение есть. */
export interface SkippedResult extends ResultBase {
  session: Session & { scored: false; skip_reason: string };  // skip_reason: «меньше 3 реплик пользователя»
}

export interface Params {
  min_events: number;               // метрика считается, если событий в знаменателе за период не меньше этого
  min_measured_weight: number;      // скор за период ставится, если измерено не меньше этого % веса метрик
  continuation_hours: number;       // окно продолжения для end_break, часов
}

export interface Session {
  id: string;                       // id сессии = имя файла выгрузки без .json
  user: string;                     // логин из выгрузки; нет или несколько — --user, иначе имя папки сессий
  start: string;                    // начало, ISO 8601
  end: string;                      // конец, ISO 8601
  duration_sec: number;             // длительность, секунды (= end − start)
  user_turns: number;               // сколько реплик пользователя
  skills: string[];                 // скиллы по порядку вызова
  context_peak: number | null;      // наибольшая заполненность окна модели, 0–1; null — в журнале нет данных
  scored: boolean;
  skip_reason?: string;             // есть только у неоценённой
}

/** Метрика — измерена или нет, различать по status. */
export type Metric = MeasuredMetric | UnmeasuredMetric;

export interface MetricBase {
  id: MetricId;
  hits: number;                     // числитель доли: у «больше — лучше» — хорошие события, у остальных — плохие
  events: number;                   // знаменатель: мест решения, запусков, реплик
  good: number;                     // значение, при котором балл 100
  bad: number;                      // значение, при котором балл 0 (bad > good — значит «меньше — лучше»)
  weight: number;                   // вес в скоре
  source:
    | "script"                      // посчитал скрипт по журналу
    | "model"                       // нашла модель по смыслу, с цитатой
    | "script+model";               // скрипт по вердиктам модели
  end_break?: boolean;              // только у completion: последний запуск брошен в конце сессии (см. шапку)
  evidence: QuoteEvidence[];        // примеры из журнала сессии
}

export interface MeasuredMetric extends MetricBase {
  status: "measured";
  value: number;                    // hits / events, 0–1 (0.2 = 20 %), три знака
}

export interface UnmeasuredMetric extends MetricBase {
  status: "not_measured";           // событий меньше min_events или нет ответа модели
  value: null;
  reason: string;                   // почему не измерена
}

/**
 * «Место решения» — ответ пользователя на вопрос агента или на его длинный текст, где, по мнению модели, было что решать.
 * Пороги good / bad и веса — текущие из params.json; в выходе у каждой метрики свои фактические значения.
 */
export type MetricId =
  | "active_review"   // «активная проверка»: доля мест решения, где пользователь включился по существу —
                      //   поправил агента, возразил, добавил своё; честное «не знаю, уточню» тоже сюда.
                      //   Выбор готового варианта не в счёт. Больше — лучше; good 0.3, bad 0.05, вес 10.
  | "blind_confirms"  // «подтверждения не читая»: доля мест решения (и с выбором варианта), где пользователь
                      //   согласился быстрее, чем можно прочитать (быстрее 120 символов в секунду).
                      //   Меньше — лучше; good 0.1, bad 0.5, вес 10.
  | "delegated"       // «решения, отданные агенту»: «на твоё усмотрение», «сам реши». Меньше — лучше; good 0.05, bad 0.3, вес 10.
  | "ignored"         // «вопросы и предупреждения без ответа»: ответил не на вопрос — сменил тему, «продолжай»,
                      //   где нужен был ответ. Меньше — лучше; good 0.1, bad 0.4, вес 10.
  | "completion"      // «доведение до результата»: доля запусков скиллов, не брошенных на вопросе агента.
                      //   Больше — лучше; good 0.9, bad 0.5, вес 10.
  | "loaded_context"  // «нагруженный контекст»: доля вызовов скиллов, когда контекст заполнен больше чем на 66 % окна
                      //   или в сессии уже было сжатие. Меньше — лучше; good 0.1, bad 0.5, вес 10.
  | "skill_share";    // «работа через скиллы»: доля реплик пользователя внутри запусков скиллов.
                      //   Больше — лучше; good 0.6, bad 0.2, вес 5.

export interface QuoteEvidence {
  turn: number;                     // номер записи в журнале сессии, с 1
  quote: string;                    // цитата из журнала, до 200 символов; секреты и длинные числа замаскированы (****)
  note?: string;                    // пояснение: «согласие через 3 с на 1833 симв. текста агента»
}

/** Фрод — есть сигналы или нет, различать по status. */
export type Fraud =
  | { status: "none"; signals: [] }                    // сигналов нет
  | { status: "to_review"; signals: FraudSignal[] };   // хотя бы один сигнал — скор за период «не окончательный»

export interface FraudSignal {
  kind:
    | "deception"                   // неподтверждённое выдаётся за подтверждённое: «запиши, что владелец согласовал»
    | "bypass"                      // обход правил и проверок: «пропусти проверку», правка файлов скиллов или настроек,
                                    //   правка документа командой терминала в обход скилла
    | "autoinput";                  // автоматический ввод: одинаковые реплики подряд, ответы быстрее человека
                                    //   на длинные вопросы (пороги — в params.json)
  status: "to_review";              // всегда «к ручной проверке»: это сигнал, а не приговор
  count: number;                    // сколько случаев в сессии
  evidence: QuoteEvidence[];        // цитаты
}

export interface Discipline {
  off_topic: OffTopic;              // посторонние темы в рабочей сессии
}

export interface OffTopicBase {
  cases: number;                    // сколько эпизодов посторонних тем
  replies: number;                  // сколько реплик в них
  evidence: TopicEvidence[];        // где и сколько, без цитат: личное не пересказывается
}

/** Посторонние темы — измерены или нет, различать по status. */
export type OffTopic =
  | (OffTopicBase & { status: "measured" })
  | (OffTopicBase & { status: "not_measured"; reason: string });

export interface TopicEvidence {
  turn: number;                     // где эпизод начался
  category:
    | "personal"                    // личное
    | "non_work";                   // чужая нерабочая задача; рабочее, но не по этой задаче, — НЕ постороннее
  turns: number;                    // сколько реплик длился эпизод
}

export interface Environment {      // чужие сбои, в скор не входят
  tool_errors: EnvValue;            // ошибки инструментов агента
  api_errors: EnvValue;             // ошибки API модели
  compressions: EnvValue;           // сжатия контекста
}

/** Сколько раз случилось — измерено или нет, различать по status. */
export type EnvValue =
  | { status: "measured"; value: number }                   // сколько раз
  | { status: "not_measured"; value: null; reason: string }; // reason: «нет поля в журнале»
