import { C, Ic, R } from "../theme";

function resolveTone(tone) {
  const tones = {
    default: {
      bg: C.w,
      border: C.b1,
      title: C.t1,
      text: C.t3,
      badgeBg: C.priGhost,
      badgeText: C.pri,
    },
    success: {
      bg: C.okPale,
      border: `${C.ok}22`,
      title: C.ok,
      text: C.t2,
      badgeBg: `${C.ok}16`,
      badgeText: C.ok,
    },
    warning: {
      bg: C.warnPale,
      border: `${C.warn}22`,
      title: C.warn,
      text: C.t2,
      badgeBg: `${C.warn}14`,
      badgeText: C.warn,
    },
    error: {
      bg: C.errPale,
      border: `${C.err}22`,
      title: C.err,
      text: C.t2,
      badgeBg: `${C.err}14`,
      badgeText: C.err,
    },
    info: {
      bg: C.infoPale,
      border: `${C.info}22`,
      title: C.info,
      text: C.t2,
      badgeBg: `${C.info}14`,
      badgeText: C.info,
    },
  };
  return tones[tone] || tones.default;
}

export function PageShell({ children, accent = "pri", style = {} }) {
  const accentColor = C[accent] || C.pri;
  return (
    <div
      className="tv-page-shell"
      style={{
        "--tv-page-accent": accentColor,
        ...style,
      }}
    >
      <div className="tv-page-shell__glow" />
      <div className="tv-page-shell__content">{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, onBack, actions, badge }) {
  return (
    <div className="tv-page-header">
      <div className="tv-page-header__main">
        {onBack ? (
          <button
            onClick={onBack}
            className="tv-page-header__back"
            aria-label="Volver"
          >
            {Ic.chev(C.pri, 18)}
          </button>
        ) : null}
        <div className="tv-page-header__titles">
          <div className="tv-page-header__topline">
            <h1 className="tv-page-header__title">{title}</h1>
            {badge ? <span className="tv-page-header__badge">{badge}</span> : null}
          </div>
          {subtitle ? <p className="tv-page-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="tv-page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, tone = "default" }) {
  const palette = resolveTone(tone);
  return (
    <section
      className="tv-section-card"
      style={{
        background: palette.bg,
        borderColor: palette.border,
      }}
    >
      {(title || subtitle || action) ? (
        <div className="tv-section-card__header">
          <div className="tv-section-card__titles">
            {title ? (
              <h2
                className="tv-section-card__title"
                style={{ color: palette.title }}
              >
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p
                className="tv-section-card__subtitle"
                style={{ color: palette.text }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="tv-section-card__action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ title, value, sub, icon, color = C.pri }) {
  return (
    <div className="tv-stat-card" style={{ "--tv-stat-color": color }}>
      <div className="tv-stat-card__header">
        <div className="tv-stat-card__icon">{icon}</div>
        <span className="tv-stat-card__title">{title}</span>
      </div>
      <div className="tv-stat-card__value">{value}</div>
      {sub ? <div className="tv-stat-card__sub">{sub}</div> : null}
    </div>
  );
}

export function StatePanel({
  title,
  description,
  tone = "default",
  icon,
  action,
  compact = false,
}) {
  const palette = resolveTone(tone);
  const fallbackIcon = tone === "error"
    ? Ic.warn(palette.badgeText, compact ? 16 : 18)
    : tone === "success"
      ? Ic.chk(palette.badgeText, compact ? 16 : 18)
      : Ic.info(palette.badgeText, compact ? 16 : 18);

  return (
    <div
      className={`tv-state-panel${compact ? " tv-state-panel--compact" : ""}`}
      style={{
        background: palette.bg,
        borderColor: palette.border,
      }}
    >
      <div
        className="tv-state-panel__icon"
        style={{
          background: palette.badgeBg,
          color: palette.badgeText,
        }}
      >
        {icon || fallbackIcon}
      </div>
      <div className="tv-state-panel__body">
        {title ? (
          <div className="tv-state-panel__title" style={{ color: palette.title }}>
            {title}
          </div>
        ) : null}
        {description ? (
          <div className="tv-state-panel__description" style={{ color: palette.text }}>
            {description}
          </div>
        ) : null}
        {action ? <div className="tv-state-panel__action">{action}</div> : null}
      </div>
    </div>
  );
}
