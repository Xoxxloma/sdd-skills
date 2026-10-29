/**
 * Типизация выхода session-quality: формат session-quality/5.
 * Итог: <папка сессий>-quality/<пользователь>-<дата>.json — один пользователь за период.
 * Источник правды — session-quality.schema.json и contract.py; этот файл — их описание для чтения.
 */

/** Корень отчёта. */
export interface SessionQualityReport {
  schema: "session-quality/5";      // версия формата
  generated_at: string;             // когда собран отчёт, ISO 8601 с поясом: "2026-10-27T15:00:00Z"
  subject: Subject;                 // кого и за какой период оценили
  params: Params;                   // с какими порогами считали
  score: Score;                     // общий скор 0–100
  metrics: Metric[];                // ровно 7 метрик (см. MetricId), из них складывается скор
  fraud: Fraud;                     // признаки нечестной работы: в скор не входят, но «замораживают» его
  discipline: Discipline;           // посторонние темы: справочно, в скор не входят
  environment: Environment;         // сбои среды, не вина пользователя: справочно
  sessions: Session[];              // все сессии из папки, и оценённые, и пропущенные
}

export interface Subject {
  user: string;                     // логин пользователя
  sessions_dir: string;             // папка с журналами, которую оценивали
  period: { from: string; to: string } | null; // от начала самой ранней до конца самой поздней сессии; null — сессий нет
  sessions_total: number;           // сколько сессий найдено
  sessions_scored: number;          // сколько оценено; почему остальные пропущены — в sessions[].skip_reason
}

export interface Params {
  file: string;                     // файл параметров (reference/params.json или свой через --params)
  min_events: number;               // метрика считается, если событий в знаменателе не меньше этого
  min_measured_weight: number;      // общий скор ставится, если измерено не меньше этого % веса метрик
}

/**
 * Общий скор — одно из трёх состояний, различать по status.
 * value = округление(Σ вес × балл / Σ вес) по измеренным метрикам.
 */
export type Score =
  | { status: "final"; value: number; reason: null; measured_weight: number }          // окончательный
  | { status: "hold"; value: number; reason: string; measured_weight: number }         // посчитан, но не окончательный:
                                                                                        //   есть сигнал фрода, нужна ручная проверка;
                                                                                        //   reason: «фрод: сигналов к проверке — 1»
  | { status: "insufficient"; value: null; reason: string; measured_weight: number };  // данных мало, скора нет: измерено
                                                                                        //   меньше min_measured_weight % веса
// measured_weight — какая доля веса метрик измерена, %.

/** Метрика — измерена или нет, различать по status. */
export type Metric = MeasuredMetric | UnmeasuredMetric;

export interface MetricBase {
  id: MetricId;
  good: number;                     // значение, при котором балл 100
  bad: number;                      // значение, при котором балл 0 (bad > good — значит «меньше — лучше»)
  weight: number;                   // вес в общем скоре
  source:
    | "script"                      // посчитал скрипт по журналу
    | "model"                       // нашла модель по смыслу, с цитатой
    | "script+model";               // скрипт по вердиктам модели
  events: number;                   // сколько событий в знаменателе: мест решения, запусков, реплик
  sessions_hit: number;             // в скольких оценённых сессиях метрика хуже good
  evidence: QuoteEvidence[];        // примеры из журналов
}

export interface MeasuredMetric extends MetricBase {
  status: "measured";
  value: number;                    // сама доля, 0–1 (0.2 = 20 %)
  score: number;                    // балл 0–100 = округление(clamp((value − bad) / (good − bad), 0, 1) × 100)
}

export interface UnmeasuredMetric extends MetricBase {
  status: "not_measured";           // событий меньше min_events — в скор не входит
  value: null;
  score: null;
  reason: string;                   // почему не измерена
}

/**
 * «Место решения» — ответ пользователя на вопрос агента или на его длинный текст, где, по мнению модели, было что решать.
 * Пороги good / bad и веса — текущие из params.json; в отчёте у каждой метрики свои фактические значения.
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
  session: string;                  // id сессии (есть в sessions[])
  turn: number;                     // номер записи в журнале сессии, с 1
  quote: string;                    // цитата из журнала, до 200 символов; секреты и длинные числа замаскированы (****)
  note?: string;                    // пояснение: «согласие через 3 с на 1833 симв. текста агента»
}

/** Фрод — есть сигналы или нет, различать по status. */
export type Fraud =
  | { status: "none"; signals: [] }                    // сигналов нет
  | { status: "to_review"; signals: FraudSignal[] };   // хотя бы один сигнал; тогда score.status = "hold"

export interface FraudSignal {
  kind:
    | "deception"                   // неподтверждённое выдаётся за подтверждённое: «запиши, что владелец согласовал»
    | "bypass"                      // обход правил и проверок: «пропусти проверку», правка файлов скиллов или настроек,
                                    //   правка документа командой терминала в обход скилла
    | "autoinput";                  // автоматический ввод: одинаковые реплики подряд, ответы быстрее человека
                                    //   на длинные вопросы (пороги — в params.json)
  status: "to_review";              // всегда «к ручной проверке»: это сигнал, а не приговор
  count: number;                    // сколько случаев
  sessions: string[];               // в каких сессиях
  evidence: QuoteEvidence[];        // цитаты
}

export interface Discipline {
  off_topic: OffTopic;              // посторонние темы в рабочих сессиях
}

export interface OffTopicBase {
  cases: number;                    // сколько эпизодов посторонних тем
  replies: number;                  // сколько реплик в них
  sessions: string[];               // в каких сессиях
  evidence: TopicEvidence[];        // где и сколько, без цитат: личное не пересказывается
}

/** Посторонние темы — измерены или нет, различать по status. */
export type OffTopic =
  | (OffTopicBase & { status: "measured" })
  | (OffTopicBase & { status: "not_measured"; reason: string });

export interface TopicEvidence {
  session: string;
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

/** Сессия — оценена или пропущена, различать по scored. */
export type Session =
  | (SessionBase & { scored: true })
  | (SessionBase & { scored: false; skip_reason: string });  // skip_reason: «меньше 3 реплик пользователя»

export interface SessionBase {
  id: string;                       // id сессии
  start: string;                    // начало, ISO 8601
  end: string;                      // конец, ISO 8601
  duration_sec: number;             // длительность, секунды (= end − start)
  user_turns: number;               // сколько реплик пользователя
  skills: string[];                 // скиллы по порядку вызова
  context_peak: number | null;      // наибольшая заполненность окна модели, 0–1; null — в журнале нет данных
}
